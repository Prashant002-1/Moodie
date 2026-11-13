import SwiftUI
import MoodieCore

struct HomeView: View {
    @Environment(AppState.self) private var state
    @State private var scope = "For you"
    @State private var responses: [FilmResponse] = []
    @State private var recommendations: Recommendations?
    @State private var cursor: String?
    @State private var loading = false
    @State private var error: String?
    @State private var recommendationError: String?
    @State private var peopleError: String?
    @State private var summaryError: String?
    @State private var request = UUID()
    @State private var people: [Member] = []
    @State private var diaryCount: Int?
    @State private var responseHeading = "Recent responses"
    @State private var feedScope = "everyone"
    @State private var loadedScope: String?
    private var requestKey: String { "\(scope)-\(state.revision)" }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                ReadingTabs(choices: ["For you", "Following", "Everyone"], selection: $scope).padding(.top, 4)
                if scope == "For you" { SuggestionsHomeSection() }
                if scope == "For you", let recommendations {
                    if let film = recommendations.forYou.first {
                        RecommendationCard(film: film)
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            PageHeading(title: diaryCount == 0 ? "Start with a film you’ve seen" : "A new connection starts with a film",
                                subtitle: diaryCount == 0 ? "Keep the words and feelings it left with you." : "No connected films yet. Add another response or explore people in the community.")
                            Button("Add a response", systemImage: "square.and.pencil") { state.composer = ComposerRequest() }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                }
                if scope == "For you", !responses.isEmpty { Text(responseHeading).font(.title3.weight(.semibold)) }
                ForEach(responses) { response in ResponseCard(response: response); Divider() }
                if loading && responses.isEmpty && recommendations == nil { ProgressView().frame(maxWidth: .infinity).padding(24) }
                if scope == "For you" {
                    if let recommendationError { InlineError(message: recommendationError) { Task { await load() } } }
                    if let peopleError { InlineError(message: peopleError) { Task { await load() } } }
                    if let summaryError { InlineError(message: summaryError) { Task { await load() } } }
                }
                if let error { InlineError(message: error) { Task { await load() } } }
                if scope != "For you" && !loading && error == nil && responses.isEmpty {
                    ContentUnavailableView(scope == "Following" ? "Your people, here" : "A place for what stayed",
                        systemImage: scope == "Following" ? "person.2" : "text.bubble",
                        description: Text(scope == "Following" ? "Follow someone to see their latest responses." : "The first response can be yours."))
                }
                if cursor != nil {
                    if scope == "For you" { Button(feedScope == "following" ? "More from your circle" : "More from the community") { scope = feedScope == "following" ? "Following" : "Everyone" } }
                    else { Button("Load more responses") { Task { await loadMore() } }.frame(maxWidth: .infinity).disabled(loading) }
                }
                if scope == "For you" {
                    if let recommendations, recommendations.forYou.count > 1 {
                        FilmShelf(title: "More through your people", films: Array(recommendations.forYou.dropFirst()))
                    }
                    if !people.isEmpty {
                        Text("People through shared films").font(.title3.weight(.semibold))
                        ForEach(Array(people.prefix(3))) { person in PersonRow(person: person); Divider() }
                        Button("Explore people") { state.selectedTab = .people }
                    }
                    if !state.saved.isEmpty { FilmShelf(title: "Saved for another night", films: Array(state.saved.prefix(8)).map(\.film)) }
                    if let recommendations, !recommendations.community.isEmpty { FilmShelf(title: "In the community", films: recommendations.community) }
                }
            }.padding(.horizontal, 20).padding(.bottom, 24).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().refreshable { await load() }.task(id: requestKey) { await load() }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Moodie").font(.system(.title2, design: .serif).weight(.medium))
                }
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink(value: ActivityRoute()) { Label("Activity", systemImage: "bell").labelStyle(.iconOnly) }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    NavigationLink(value: SuggestionsRoute()) { Label("Recommendations", systemImage: "tray").labelStyle(.iconOnly) }.accessibilityIdentifier("open-recommendations")
                    AddResponseButton()
                }
            }
    }
    private func load() async {
        let key = requestKey, token = UUID(); request = token
        loading = true; error = nil; recommendationError = nil; peopleError = nil; summaryError = nil
        if loadedScope != scope { cursor = nil; responses = []; recommendations = nil; people = [] }
        defer { if request == token { loading = false } }
        async let feed: Void = loadFeed(key: key, token: token)
        if scope == "For you" {
            async let recs: Void = loadRecommendations(key: key, token: token)
            async let members: Void = loadPeople(key: key, token: token)
            async let summary: Void = loadSummary(key: key, token: token)
            _ = await (recs, members, summary)
        }
        await feed
        if request == token && key == requestKey { loadedScope = scope }
    }
    private func isCurrent(_ key: String, _ token: UUID) -> Bool { !Task.isCancelled && requestKey == key && request == token }
    private func loadRecommendations(key: String, token: UUID) async {
        do { let result: Recommendations = try await state.api.send("recommendations", body: EmptyBody()); if isCurrent(key, token) { recommendations = result } }
        catch { if isCurrent(key, token) { recommendations = nil; recommendationError = "Recommendations couldn’t be loaded. Your circle is still available." } }
    }
    private func loadPeople(key: String, token: UUID) async {
        do { let result: PeopleResult = try await state.api.get("discovery/people", query: ["limit": "6", "scope": "discover"]); if isCurrent(key, token) { people = result.people.filter { $0.sharedFilmTitle != nil } } }
        catch { if isCurrent(key, token) { people = []; peopleError = "People couldn’t be loaded." } }
    }
    private func loadSummary(key: String, token: UUID) async {
        do { let result: DiarySummary = try await state.api.get("diary/summary"); if isCurrent(key, token) { diaryCount = result.entries } }
        catch { if isCurrent(key, token) { diaryCount = nil; summaryError = "Your diary summary couldn’t be loaded." } }
    }
    private func loadFeed(key: String, token: UUID) async {
        let selected = scope
        do {
            let initialScope = selected == "Everyone" ? "everyone" : "following"
            let limit = selected == "For you" ? "3" : "24"
            var page: FeedPage = try await state.api.get("discovery/feed", query: ["scope": initialScope, "limit": limit])
            var nextFeedScope = initialScope, nextHeading = "From your circle"
            if selected == "For you" && page.entries.isEmpty {
                page = try await state.api.get("discovery/feed", query: ["scope": "everyone", "limit": limit])
                nextFeedScope = "everyone"; nextHeading = "From the community"
            }
            guard isCurrent(key, token) else { return }
            responses = page.entries; cursor = page.nextCursor
            feedScope = nextFeedScope; responseHeading = nextHeading
        } catch { if isCurrent(key, token) { responses = []; cursor = nil; self.error = error.localizedDescription } }
    }
    private func loadMore() async {
        guard let cursor, !loading else { return }
        let key = requestKey, token = request
        loading = true; defer { if isCurrent(key, token) { loading = false } }
        do {
            let page: FeedPage = try await state.api.get("discovery/feed", query: ["scope": feedScope, "limit": "24", "cursor": cursor])
            guard isCurrent(key, token) else { return }
            let ids = Set(responses.map(\.id)); responses += page.entries.filter { !ids.contains($0.id) }; self.cursor = page.nextCursor
        } catch { state.handle(error) }
    }
}

struct FilmShelf: View {
    let title: String
    let films: [Film]
    var more: (() -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                if let more { Button("See all", action: more).font(.caption).frame(minHeight: 44) }
            }
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 16) {
                    ForEach(films) { film in
                        NavigationLink(value: film) {
                            VStack(alignment: .leading, spacing: 9) {
                                Poster(path: film.posterPath, width: 110, title: film.title)
                                Text(film.title).font(.subheadline.weight(.medium)).foregroundStyle(MoodieTheme.ink).lineLimit(2)
                                if let source = film.recommendedBy?.first { Text("Through \(source.username)").font(.caption).foregroundStyle(MoodieTheme.secondary) }
                            }.frame(width: 110, alignment: .leading)
                        }.buttonStyle(.plain)
                    }
                }
            }.scrollIndicators(.hidden)
        }
    }
}

struct RecommendationCard: View {
    @Environment(AppState.self) private var state
    @Environment(\.dynamicTypeSize) private var typeSize
    let film: Film
    @State private var comparison = false
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    if let source = film.recommendedBy?.first {
                        NavigationLink(value: MemberRoute(username: source.username)) {
                            HStack(spacing: 8) {
                                Avatar(name: source.username, size: 24)
                                Text("Through \(source.username)").font(.caption.weight(.medium))
                            }
                        }.buttonStyle(.plain)
                    }
                    NavigationLink(value: film) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(film.title).font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
                            Text(film.year).font(.caption).foregroundStyle(MoodieTheme.secondary)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }.buttonStyle(.plain)
                }
                NavigationLink(value: film) { Poster(path: film.posterPath, width: 62, title: film.title) }
                    .buttonStyle(.plain).accessibilityLabel("Open \(film.title)")
            }
            if let source = film.recommendedBy?.first {
                NavigationLink(value: ActivityResponseRoute(id: source.responseId)) {
                    Text(source.responseNote).font(.body).lineSpacing(3).lineLimit(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }.buttonStyle(.plain)
                Text(source.responseFeelings.map(\.title).joined(separator: " · "))
                    .font(.caption.weight(.medium)).foregroundStyle(MoodieTheme.secondary)
                (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))) {
                    Button { comparison = true } label: {
                        HStack(spacing: 6) {
                            Text("Through ") + Text(source.sharedFilmTitle).fontWeight(.medium)
                            Image(systemName: "arrow.up.right").font(.caption2)
                        }.font(.caption).foregroundStyle(MoodieTheme.secondary).frame(minHeight: 44, alignment: .leading)
                    }.buttonStyle(.plain).accessibilityLabel("Your common ground: \(source.sharedFilmTitle)")
                    if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                    KeepRecommendationButton(sourceEntryId: source.responseId, compact: true)
                }.overlay(alignment: .top) { MoodieTheme.rule.frame(height: 0.5) }
            }
        }.padding(18).background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(MoodieTheme.rule, lineWidth: 0.6))
            .sheet(isPresented: $comparison) {
                NavigationStack { ConnectionView(film: film).appDestinations() }.presentationDragIndicator(.visible)
            }
    }
}

struct ConnectionView: View {
    let film: Film
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ForEach(film.recommendedBy ?? []) { source in
                    if let id = source.sharedMovieId {
                        NavigationLink(value: Film(id: id, title: source.sharedFilmTitle)) {
                            PageHeading(title: source.sharedFilmTitle, subtitle: "The film you have in common")
                        }.buttonStyle(.plain)
                    } else { PageHeading(title: source.sharedFilmTitle, subtitle: "The film you have in common") }
                    VStack(alignment: .leading, spacing: 10) {
                        Text("You").font(.headline); Text(source.viewerSharedNote.isEmpty ? "You recorded feelings for this film." : source.viewerSharedNote)
                        if let feelings = source.viewerSharedFeelings { FeelingTrace(feelings: feelings) }
                    }
                    Divider()
                    VStack(alignment: .leading, spacing: 10) {
                        NavigationLink(value: MemberRoute(username: source.username)) { Text(source.username).font(.headline) }
                        Text(source.personSharedNote)
                        if let feelings = source.personSharedFeelings { FeelingTrace(feelings: feelings) }
                        else { Text(source.sharedFeelings.map(\.title).joined(separator: " · ")).font(.subheadline).foregroundStyle(MoodieTheme.secondary) }
                        if let id = source.sharedResponseId {
                            NavigationLink(value: ActivityResponseRoute(id: id)) { Text("Read their response").frame(minHeight: 44).contentShape(Rectangle()) }
                        }
                    }
                    Divider()
                    Text("Then, \(source.username) watched \(film.title).").font(.system(.title2, design: .serif))
                    Text(source.responseNote)
                    Text(source.responseFeelings.map(\.title).joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                    NavigationLink(value: ActivityResponseRoute(id: source.responseId)) {
                        Text("Read the response to \(film.title)").frame(minHeight: 44).contentShape(Rectangle())
                    }
                    KeepRecommendationButton(sourceEntryId: source.responseId)
                    Divider()
                }
                SavedStatusRecovery(ids: [film.id])
                NavigationLink(value: film) { Label("Open \(film.title)", systemImage: "film") }
                    .buttonStyle(MoodieActionStyle()).accessibilityIdentifier("connection-open-film")
                Button(state.savedStatus[film.id] == nil ? "Checking saved films" : state.isSaved(film.id) ? "Remove from saved films" : "Save film", systemImage: state.isSaved(film.id) ? "bookmark.fill" : "bookmark") {
                    Task { await state.toggleSaved(film) }
                }.disabled(state.isMutating.contains("save-\(film.id)") || state.savedStatus[film.id] == nil)
            }.padding(24).frame(maxWidth: 600)
        }.moodieScreen().navigationTitle("Common ground").navigationBarTitleDisplayMode(.inline)
            .task(id: state.revision) { await state.loadSavedStatus([film.id]) }
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
    }
}
