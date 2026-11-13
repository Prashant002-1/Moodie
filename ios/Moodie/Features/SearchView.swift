import SwiftUI
import MoodieCore

struct SearchView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var query = ""
    @State private var section = "Films"
    @State private var films: [Film] = []
    @State private var community: [CommunityFilm] = []
    @State private var people: [Member] = []
    @State private var feeling: Feeling = .happy
    @State private var loading = false
    @State private var error: String?
    @State private var peopleOffset: Int?
    @State private var page = 1
    @State private var totalPages = 1
    @State private var showAllSaved = false
    @State private var loadedCriteria: String?
    var selectFilm: ((Film) -> Void)?
    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var idle: Bool { section == "Films" && trimmedQuery.isEmpty }
    private var criteria: String { "\(section)-\(section != "Feelings" ? trimmedQuery : "")-\(feeling.rawValue)" }
    private var requestKey: String { "\(criteria)-\(state.revision)" }
    private var visibleFilms: [Film] { section == "Feelings" && !trimmedQuery.isEmpty ? films.filter { $0.title.localizedCaseInsensitiveContains(trimmedQuery) } : films }
    private var visiblePeople: [Member] { people }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if selectFilm == nil {
                    ReadingTabs(choices: ["Films", "Feelings", "People"], selection: $section).padding(.top, 4)
                }
                if section == "Feelings" {
                    Text("How would you like to feel?").font(.system(.title2, design: .serif)).padding(.top, 6)
                    WrappingLayout {
                        ForEach(Feeling.allCases) { item in
                            ChoiceButton(title: item.title, selected: feeling == item, color: MoodieTheme.color(item)) { feeling = item }
                                .accessibilityIdentifier("search-feeling-\(item.rawValue)")
                        }
                    }.sensoryFeedback(.selection, trigger: feeling)
                }
                if idle {
                    if !state.saved.isEmpty {
                        if selectFilm == nil {
                            FilmShelf(title: "Saved for later", films: Array(state.saved.prefix(8)).map(\.film), more: { showAllSaved = true })
                        } else {
                            Text("Saved films").font(.headline)
                            ForEach(Array(state.saved.prefix(6))) { saved in filmResult(saved.film); Divider() }
                            Button("All saved films") { showAllSaved = true }
                        }
                    }
                    if !community.isEmpty {
                        Text("Recently watched").font(.headline).padding(.top, 8)
                        ForEach(community) { item in
                            filmResult(item.film)
                            if let username = item.latestUsername, selectFilm == nil {
                                NavigationLink(value: MemberRoute(username: username)) { Text("Recently watched by \(username)").font(.caption) }
                            }
                            Divider()
                        }
                    }
                } else if section == "People" {
                    ForEach(visiblePeople) { PersonRow(person: $0); Divider() }
                    if peopleOffset != nil { Button("More people") { Task { await morePeople() } }.disabled(loading) }
                    if !loading && error == nil && visiblePeople.isEmpty {
                        ContentUnavailableView("No people found", systemImage: "person.2", description: Text("Try another name or return as the community grows."))
                    }
                } else {
                    ForEach(visibleFilms) { film in
                        if section == "Feelings" { RecommendationCard(film: film) }
                        else { filmResult(film); Divider() }
                    }
                    if page < totalPages && section == "Films" {
                        Button("More films") { Task { await more() } }.disabled(loading).frame(maxWidth: .infinity)
                    }
                }
                SavedStatusRecovery(ids: films.map(\.id) + community.map(\.movieId))
                if loading { ProgressView().frame(maxWidth: .infinity).padding() }
                if let error { InlineError(message: error) { Task { await search() } } }
                if !loading && error == nil && section != "People" && (idle ? community.isEmpty && state.saved.isEmpty : visibleFilms.isEmpty) {
                    ContentUnavailableView {
                        Label(section == "Feelings" ? "No connected films yet" : idle ? "Find a film" : "No films found", systemImage: section == "Feelings" ? "person.2" : "magnifyingglass")
                    } description: {
                        Text(section == "Feelings" ? "Add responses to films you’ve seen to find films through other people." : idle ? "Search for a title you watched or one you want to see." : "Try a different title or spelling.")
                    } actions: {
                        if section == "Feelings" { Button("Add a response") { state.composer = ComposerRequest() } }
                    }
                }
            }.padding(.horizontal, 20).padding(.bottom, 24).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle(selectFilm == nil ? "Search" : "Choose a film").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: typeSize.isAccessibilitySize ? .automatic : .always), prompt: section == "People" ? "Find a person" : section == "Feelings" ? "Filter these films" : "Search films")
            .scrollDismissesKeyboard(.interactively)
            .task(id: requestKey) { await search() }
            .sheet(isPresented: $showAllSaved) {
                NavigationStack {
                    SavedFilmsView(selectFilm: selectFilm.map { selection in { film in showAllSaved = false; selection(film) } })
                        .appDestinations()
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showAllSaved = false } } }
                }
            }
            .onChange(of: section) { _, _ in query = "" }
            .toolbar { if selectFilm == nil { ToolbarItem(placement: .topBarTrailing) { AddResponseButton() } } }
    }
    @ViewBuilder private func filmResult(_ film: Film) -> some View {
        if let selectFilm { Button { selectFilm(film) } label: { FilmRow(film: film) }.buttonStyle(.plain) }
        else {
            (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 8))) {
                NavigationLink(value: film) { FilmRow(film: film).frame(maxWidth: .infinity, alignment: .leading) }
                    .buttonStyle(.plain).accessibilityIdentifier("film-result-\(film.id)")
                HStack(spacing: 8) {
                Button { Task { await state.toggleSaved(film) } } label: {
                    Image(systemName: state.isSaved(film.id) ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 21))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(state.isMutating.contains("save-\(film.id)") || state.savedStatus[film.id] == nil)
                    .accessibilityLabel(state.savedStatus[film.id] == nil ? "Checking saved films" : state.isSaved(film.id) ? "Unsave \(film.title)" : "Save \(film.title)")
                    .accessibilityIdentifier("save-film-\(film.id)")
                Button { state.composer = ComposerRequest(film: film) } label: {
                    Image(systemName: "square.and.pencil").font(.system(size: 21)).frame(width: 44, height: 44).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityLabel("Add a response to \(film.title)")
                }
            }
        }
    }
    private func search() async {
        let key = requestKey
        loading = true; error = nil
        if loadedCriteria != criteria { films = []; people = []; peopleOffset = nil; community = []; page = 1; totalPages = 1 }
        defer { if key == requestKey { loading = false } }
        do {
            try await Task.sleep(for: .milliseconds(250))
            if section == "People" {
                let result: PeopleResult = try await state.api.get("discovery/people", query: ["limit": "30", "q": trimmedQuery]); try Task.checkCancellation(); guard key == requestKey else { return }; people = result.people; peopleOffset = result.nextOffset
            } else if section == "Feelings" {
                var signal = Feelings(); signal[feeling] = 1
                struct Input: Encodable { let signal: Feelings }
                let result: Recommendations = try await state.api.send("recommendations", body: Input(signal: signal))
                try Task.checkCancellation(); guard key == requestKey else { return }
                var ids = Set<Int>(); films = (result.forYou + result.adjacent).filter { ids.insert($0.id).inserted }
            } else if !trimmedQuery.isEmpty {
                let result: FilmPage = try await state.api.get("catalog/search", query: ["q": trimmedQuery, "page": "1"])
                try Task.checkCancellation(); guard key == requestKey else { return }; films = result.results; page = 1; totalPages = min(result.totalPages ?? 1, 100)
            } else {
                let result: CommunityResult = try await state.api.get("discovery/pulse")
                try Task.checkCancellation(); guard key == requestKey else { return }; community = result.films
            }
            loadedCriteria = criteria
            await state.loadSavedStatus(films.map(\.id) + community.map(\.movieId))
        } catch { if !Task.isCancelled, key == requestKey { self.error = error.localizedDescription } }
    }
    private func morePeople() async {
        guard let peopleOffset, !loading else { return }
        let key = requestKey; loading = true; error = nil
        defer { if key == requestKey { loading = false } }
        do {
            let result: PeopleResult = try await state.api.get("discovery/people", query: ["limit": "30", "offset": String(peopleOffset), "q": trimmedQuery])
            try Task.checkCancellation(); guard key == requestKey else { return }
            let ids = Set(people.map(\.id)); people += result.people.filter { !ids.contains($0.id) }; self.peopleOffset = result.nextOffset
        } catch { if !Task.isCancelled && key == requestKey { self.error = error.localizedDescription } }
    }
    private func more() async {
        let key = requestKey
        loading = true; defer { if key == requestKey { loading = false } }
        do {
            let result: FilmPage = try await state.api.get("catalog/search", query: ["q": trimmedQuery, "page": String(page + 1)])
            guard key == requestKey else { return }
            let ids = Set(films.map(\.id)); films += result.results.filter { !ids.contains($0.id) }; page += 1
            await state.loadSavedStatus(result.results.map(\.id))
        } catch { state.handle(error) }
    }
}
