import SwiftUI
import MoodieCore

struct FilmDetailView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dynamicTypeSize) private var typeSize
    let film: Film
    @State private var details: Film?
    @State private var responses: [FilmResponse] = []
    @State private var related: [Film] = []
    @State private var section = "Responses"
    @State private var loading = true
    @State private var scope = "Everyone"
    @State private var offset: Int?
    @State private var total: Int?
    @State private var request = UUID()
    @State private var loadedKey = ""
    @State private var catalogError: String?
    private var responseKey: String { "\(film.id):\(state.revision):\(scope)" }
    @State private var error: String?
    @State private var relatedLoading = false
    @State private var relatedError: String?
    @State private var relatedLoaded = false
    @State private var aboutExpanded = false
    private var current: Film { details ?? film }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .top, spacing: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(current.title).font(.system(.largeTitle, design: .serif))
                            .fixedSize(horizontal: false, vertical: true)
                        Text([current.year, current.runtime.flatMap { $0 > 0 ? "\($0) min" : nil } ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                        if let genres = current.genres, !genres.isEmpty {
                            Text(genres.map(\.name).joined(separator: " · ")).font(.caption).foregroundStyle(MoodieTheme.secondary)
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    Poster(path: current.posterPath, width: typeSize.isAccessibilitySize ? 60 : 92, title: current.title)
                }.padding(.top, 10)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { filmActions }
                    VStack(alignment: .leading, spacing: 12) { filmActions }
                }
                SavedStatusRecovery(ids: [film.id])
                if let source = film.recommendedBy?.first {
                    NavigationLink { ConnectionView(film: film) } label: {
                        HStack(spacing: 10) {
                            Avatar(name: source.username, size: 28)
                            Text("You and \(source.username) on \(source.sharedFilmTitle)")
                                .font(.subheadline).frame(maxWidth: .infinity, alignment: .leading)
                            Image(systemName: "chevron.right").font(.caption2)
                        }.frame(minHeight: 44).contentShape(Rectangle())
                    }.buttonStyle(.plain).accessibilityLabel("Compare your responses to \(source.sharedFilmTitle)")
                }
                if let catalogError { InlineError(message: catalogError) { Task { await loadCatalog() } } }
                SuggestionsForFilm(movieId: film.id)
                if let overview = current.overview, !overview.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(overview).font(.subheadline).lineSpacing(4).lineLimit(aboutExpanded ? nil : 3).textSelection(.enabled)
                        if aboutExpanded, let url = Artwork.url(path: current.backdropPath, width: 780) {
                            AsyncImage(url: url) { image in image.resizable().scaledToFill() }
                            placeholder: { MoodieTheme.surface }
                                .frame(height: 180).clipped().clipShape(RoundedRectangle(cornerRadius: 8)).accessibilityHidden(true)
                        }
                        if overview.count > 170 || current.backdropPath != nil {
                            Button(aboutExpanded ? "Show less" : "More about this film") { aboutExpanded.toggle() }
                                .font(.caption).frame(minHeight: 44)
                        }
                    }
                }
                ReadingTabs(choices: ["Responses", "Related films"], selection: $section)
                if section == "Responses" {
                    ReadingTabs(choices: ["Everyone", "Following"], selection: $scope)
                    if let total { Text("\(total) \(total == 1 ? "response" : "responses")").font(.caption).foregroundStyle(MoodieTheme.secondary) }
                    if let error { InlineError(message: error) { Task { await load() } } }
                    if loading && responses.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                    ForEach(responses) { ResponseCard(response: $0, showsFilm: false); Divider() }
                    if offset != nil { Button("More responses") { Task { await load(more: true) } }.disabled(loading) }
                    if responses.isEmpty && !loading && error == nil {
                        ContentUnavailableView("What did it leave with you?", systemImage: "text.bubble", description: Text("Be the first to share a response to this film."))
                    }
                } else {
                    if let relatedError { InlineError(message: relatedError) { Task { await loadRelated() } } }
                    if relatedLoading { ProgressView().frame(maxWidth: .infinity) }
                    ForEach(related) { relatedFilm in
                        NavigationLink(value: relatedFilm) { FilmRow(film: relatedFilm) }.buttonStyle(.plain)
                        Divider()
                    }
                    if related.isEmpty && relatedLoaded && relatedError == nil { Text("No related films are available yet.").font(.subheadline).foregroundStyle(MoodieTheme.secondary) }
                }
                Text("Film information and artwork from TMDB.").font(.caption2).foregroundStyle(MoodieTheme.secondary).padding(.top, 8)
            }.padding(.horizontal, 20).padding(.bottom, 30).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle("Film").navigationBarTitleDisplayMode(.inline)
            .task(id: responseKey) { await load() }
            .task(id: film.id) { await loadCatalog() }
            .task(id: "saved-\(state.revision)") { await state.loadSavedStatus([film.id]) }
            .task(id: section) { if section == "Related films" && !relatedLoaded { await loadRelated() } }
            .refreshable { if section == "Related films" { await loadRelated() } else { await load() } }
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: FilmHistoryRoute(film: current)) {
                    Label("Your viewings of this film", systemImage: "clock.arrow.circlepath").labelStyle(.iconOnly)
                }
            } }
    }
    @ViewBuilder private var filmActions: some View {
        Button("Add response", systemImage: "square.and.pencil") { state.composer = ComposerRequest(film: current) }
            .buttonStyle(MoodieActionStyle())
        HStack(spacing: 12) {
        Button { Task { await state.toggleSaved(current) } } label: {
            Image(systemName: state.isSaved(film.id) ? "bookmark.fill" : "bookmark").font(.system(size: 21)).frame(width: 44, height: 46).contentShape(Rectangle())
        }.buttonStyle(.plain).accessibilityLabel(state.savedStatus[film.id] == nil ? "Checking saved films" : state.isSaved(film.id) ? "Remove from saved films" : "Save for later")
            .disabled(state.isMutating.contains("save-\(film.id)") || state.savedStatus[film.id] == nil)
        RecommendFilmButton(title: "Recommend to someone", film: current, iconOnly: true)
            .accessibilityIdentifier("recommend-film")
        }
    }
    private func loadCatalog() async {
        catalogError = nil
        do { let result: Film = try await state.api.get("catalog/movies/\(film.id)"); try Task.checkCancellation(); details = result }
        catch { if !Task.isCancelled { catalogError = "Film catalog details couldn’t be loaded. Your responses are still available." } }
    }
    private func load(more: Bool = false) async {
        let key = responseKey, token = UUID(); request = token
        if loadedKey != key { responses = []; offset = nil; total = nil; loadedKey = key }
        loading = true; error = nil; defer { if request == token { loading = false } }
        do {
            let result: ResponsesResult = try await state.api.get("discovery/films/\(film.id)", query: ["scope": scope.lowercased(), "limit": "30", "offset": String(more ? offset ?? 0 : 0)])
            try Task.checkCancellation(); guard request == token, key == responseKey else { return }
            if more { let ids = Set(responses.map(\.id)); responses += result.entries.filter { !ids.contains($0.id) } } else { responses = result.entries }
            offset = result.nextOffset; total = result.summary?.total
        } catch { if !Task.isCancelled && request == token && key == responseKey { responses = []; offset = nil; total = nil; self.error = error.localizedDescription } }
    }
    private func loadRelated() async {
        relatedLoading = true; relatedError = nil; defer { relatedLoading = false }
        do {
            let result: FilmPage = try await state.api.get("catalog/movies/\(film.id)/related")
            try Task.checkCancellation(); related = result.results; relatedLoaded = true
        } catch { if !Task.isCancelled { relatedError = error.localizedDescription } }
    }
}


struct SavedStatusRecovery: View {
    @Environment(AppState.self) private var state
    let ids: [Int]
    var body: some View {
        if let message = ids.compactMap({ state.savedStatusErrors[$0] }).first {
            InlineError(message: "Your saved status couldn’t be checked. \(message)") { Task { await state.loadSavedStatus(ids) } }
        }
    }
}
