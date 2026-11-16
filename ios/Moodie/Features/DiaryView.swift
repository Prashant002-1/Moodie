import SwiftUI
import MoodieCore

struct DiaryView: View {
    @Environment(AppState.self) private var state
    @State private var section = "Viewings"
    @State private var filter = "All"
    @State private var query = ""
    @State private var responses: [FilmResponse] = []
    @State private var summary: DiarySummary?
    @State private var offset: Int?
    @State private var loading = false
    @State private var error: String?
    @State private var deleting: FilmResponse?
    @State private var recentExpanded = false
    @State private var loadedCriteria: String?
    private var criteria: String { "\(query)-\(filter)" }
    private var requestKey: String { "\(section)-\(query)-\(filter)-\(state.revision)" }
    private var months: [String] { Array(Set(responses.map { String($0.watchedOn.prefix(7)) })).sorted(by: >) }

    var body: some View {
        List {
            Section {
                HStack(alignment: .center, spacing: 18) {
                    ReadingTabs(choices: ["Viewings", "Saved"], selection: $section)
                    if section == "Viewings" {
                        Menu {
                            Picker("Visibility", selection: $filter) {
                                ForEach(["All", "Private", "Public"], id: \.self) { Text($0).tag($0) }
                            }
                        } label: {
                            Image(systemName: filter == "All" ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
                                .frame(width: 44, height: 44)
                        }.accessibilityLabel("Filter viewings: \(filter)").accessibilityIdentifier("diary-filter")
                    }
                }.listRowSeparator(.hidden)
            }.listRowBackground(Color.clear)
            if section == "Viewings" {
                if query.isEmpty, filter == "All", let recent = summary?.recent, recent.entries > 0 {
                    DisclosureGroup(isExpanded: $recentExpanded) {
                        FeelingTrace(feelings: recent.feelings).padding(.vertical, 8)
                    } label: {
                        Text("\(recent.entries) \(recent.entries == 1 ? "viewing" : "viewings") in the past 30 days")
                            .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                    }.listRowBackground(Color.clear).listRowSeparator(.hidden)
                }
                if filter != "All" {
                    HStack {
                        Label("\(filter) viewings", systemImage: filter == "Private" ? "lock" : "globe")
                        Spacer()
                        Button("Clear") { filter = "All" }.frame(minHeight: 44)
                    }.font(.subheadline).listRowBackground(Color.clear).listRowSeparator(.hidden)
                }
                ForEach(months, id: \.self) { month in
                    Section {
                        ForEach(responses.filter { $0.watchedOn.hasPrefix(month) }) { response in
                            NavigationLink(value: ResponseRoute(response: response)) { DiaryEntryRow(response: response) }
                                .listRowBackground(Color.clear)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button("Delete", role: .destructive) { deleting = response }
                                    Button("Edit") { state.composer = ComposerRequest(response: response) }.tint(MoodieTheme.accent)
                                }
                        }
                    } header: {
                        Text(monthTitle(month)).font(.system(.title3, design: .serif)).foregroundStyle(MoodieTheme.ink)
                            .textCase(nil).padding(.vertical, 8)
                    }
                }
                if offset != nil { Button("Load earlier viewings") { Task { await loadMore() } }.disabled(loading).listRowBackground(Color.clear) }
                if !loading && error == nil && responses.isEmpty {
                    ContentUnavailableView {
                        Label(query.isEmpty && filter == "All" ? "Your films, in your words" : "No matching viewings", systemImage: "book.closed")
                    } description: {
                        Text(query.isEmpty && filter == "All" ? "Keep a response to a film you’ve watched. Every viewing has room for its own feelings." : "Try a different search or visibility filter.")
                    } actions: {
                        if query.isEmpty && filter == "All" { Button("Add a response") { state.composer = ComposerRequest() } }
                        else { Button("Clear filters") { query = ""; filter = "All" } }
                    }.listRowBackground(Color.clear).listRowSeparator(.hidden)
                }
            } else {
                NavigationLink(value: SuggestionsRoute()) { Label("The people behind your saved films", systemImage: "tray") }.listRowBackground(Color.clear)
                SavedFilmRows(query: query)

            }
            if loading && section == "Viewings" { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if let error, section == "Viewings" { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
        }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
            .navigationTitle("Diary").navigationBarTitleDisplayMode(.inline).searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: section == "Viewings" ? "Search your diary" : "Search saved films")
            .task(id: requestKey) { await load() }.refreshable { await load(); await state.refreshSaved() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Account", systemImage: "person.crop.circle") { state.settingsPresented = true }.labelStyle(.iconOnly)
                    AddResponseButton()
                }
            }
            .alert("Delete this response?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) {
                Button("Cancel", role: .cancel) { deleting = nil }
                Button("Delete response", role: .destructive) { if let deleting { Task { await remove(deleting) } } }
            } message: { Text("Your note, feelings, photo, and comments on this response will be permanently removed.") }
    }
    private func parameters(offset: Int = 0) -> [String: String] {
        var values = ["limit": "50", "offset": String(offset)]
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { values["q"] = query }
        if filter != "All" { values["visibility"] = filter.lowercased() }
        return values
    }
    private func monthTitle(_ key: String) -> String {
        guard let date = Day.date(from: key + "-01") else { return key }
        return date.formatted(.dateTime.month(.wide).year())
    }
    private func load() async {
        guard section == "Viewings" else { return }
        let key = requestKey
        loading = true; error = nil
        if loadedCriteria != criteria { responses = []; offset = nil }
        defer { if key == requestKey { loading = false } }
        do {
            try await Task.sleep(for: .milliseconds(200))
            async let page: DiaryPage = state.api.get("diary", query: parameters())
            async let counts: DiarySummary = state.api.get("diary/summary")
            let result = try await (page, counts); try Task.checkCancellation()
            guard key == requestKey else { return }
            responses = result.0.entries; offset = result.0.nextOffset; summary = result.1; loadedCriteria = criteria
        } catch {
            guard !Task.isCancelled, key == requestKey else { return }
            self.error = error.localizedDescription
        }
    }
    private func loadMore() async {
        guard let offset, !loading else { return }
        let key = requestKey; loading = true; defer { if key == requestKey { loading = false } }
        do {
            let page: DiaryPage = try await state.api.get("diary", query: parameters(offset: offset))
            guard key == requestKey else { return }
            let ids = Set(responses.map(\.id)); responses += page.entries.filter { !ids.contains($0.id) }; self.offset = page.nextOffset
        } catch { state.handle(error) }
    }
    private func remove(_ response: FilmResponse) async {
        do { try await state.api.mutate("diary/\(response.id)", method: "DELETE", body: EmptyBody()); state.revision += 1; deleting = nil }
        catch { state.handle(error) }
    }
}

struct DiaryEntryRow: View {
    let response: FilmResponse
    var groupedByMonth = true
    private var watched: Date? { Day.date(from: String(response.watchedOn.prefix(10))) }
    private var metadata: String {
        var parts: [String] = []
        if !groupedByMonth, let watched { parts.append(watched.formatted(.dateTime.month(.abbreviated).day().year())) }
        if !response.film.year.isEmpty { parts.append(response.film.year) }
        if response.visibility == "private" { parts.append("Private") }
        if let count = response.viewingCount, count > 1 { parts.append("\(count) viewings") }
        return parts.joined(separator: " · ")
    }
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            if groupedByMonth, let watched {
                VStack(alignment: .center, spacing: 2) {
                    Text(watched, format: .dateTime.day()).font(.system(.title2, design: .serif)).monospacedDigit()
                    Text(watched, format: .dateTime.weekday(.abbreviated)).font(.caption2).foregroundStyle(MoodieTheme.secondary)
                }.frame(minWidth: 32).padding(.top, 2)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Watched \(watched.formatted(date: .long, time: .omitted))")
            }
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(response.title).font(.system(.title3, design: .serif)).fixedSize(horizontal: false, vertical: true)
                        Text(metadata).font(.caption).foregroundStyle(MoodieTheme.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    Poster(path: response.posterPath, width: 42, title: response.title)
                }
                if !response.note.isEmpty { Text(response.note).font(.subheadline).lineSpacing(3).lineLimit(3) }
                FeelingTrace(feelings: response.feelings)
            }
        }.foregroundStyle(MoodieTheme.ink).padding(.vertical, 12)
    }
}

struct FilmHistoryView: View {
    @Environment(AppState.self) private var state
    let film: Film
    @State private var entries: [FilmResponse] = []
    @State private var offset: Int?
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        List {
            Section {
                NavigationLink(value: film) { FilmRow(film: film) }
                Button("Add another viewing", systemImage: "square.and.pencil") { state.composer = ComposerRequest(film: film) }
            }.listRowBackground(Color.clear)
            Section("Your viewings") {
                ForEach(entries) { response in
                    NavigationLink(value: ResponseRoute(response: response)) { DiaryEntryRow(response: response, groupedByMonth: false) }.listRowBackground(Color.clear)
                }
                if let offset { Button("Earlier viewings") { Task { await load(offset: offset) } }.disabled(loading) }
            }
            if loading { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if let error { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
            if !loading && error == nil && entries.isEmpty { Text("You haven’t recorded a viewing of this film yet.").listRowBackground(Color.clear) }
        }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
            .navigationTitle("Your viewings").navigationBarTitleDisplayMode(.inline)
            .task(id: state.revision) { await load() }.refreshable { await load() }
    }
    private func load(offset: Int = 0) async {
        loading = true; error = nil; defer { loading = false }
        do {
            let result: DiaryPage = try await state.api.get("diary", query: ["movieId": String(film.id), "limit": "50", "offset": String(offset)])
            try Task.checkCancellation()
            if offset == 0 { entries = result.entries }
            else { let ids = Set(entries.map(\.id)); entries += result.entries.filter { !ids.contains($0.id) } }
            self.offset = result.nextOffset
        } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
}


struct SavedFilmsView: View {
    @State private var query = ""
    var selectFilm: ((Film) -> Void)?
    var body: some View {
        List { SavedFilmRows(query: query, selectFilm: selectFilm) }
            .listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
            .navigationTitle("Saved films").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search saved films")
    }
}

struct SavedFilmRows: View {
    @Environment(AppState.self) private var state
    let query: String
    var selectFilm: ((Film) -> Void)?
    @State private var films: [SavedFilm] = []
    @State private var offset: Int?
    @State private var loading = true
    @State private var error: String?
    @State private var loadedKey = ""
    @State private var request = UUID()
    private var requestKey: String { "\(state.user?.id ?? 0):\(query):\(state.revision)" }
    var body: some View {
        Group {
            ForEach(films) { item in
                Group {
                    if let selectFilm { Button { selectFilm(item.film) } label: { FilmRow(film: item.film) }.buttonStyle(.plain) }
                    else { NavigationLink(value: item.film) { FilmRow(film: item.film) } }
                }.listRowBackground(Color.clear)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button("Unsave", role: .destructive) { Task { await state.toggleSaved(item.film) } }
                        Button("Watched") { state.composer = ComposerRequest(film: item.film) }.tint(MoodieTheme.accent)
                    }
            }
            if loading { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if let error { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
            if !loading && error == nil && films.isEmpty { Text(query.isEmpty ? "Save a film when it catches your attention. It will be here when you’re ready." : "No saved films match this search.").listRowBackground(Color.clear) }
            if offset != nil { Button("More saved films") { Task { await load(more: true) } }.disabled(loading).listRowBackground(Color.clear) }
        }.task(id: requestKey) { await load() }
    }
    private func load(more: Bool = false) async {
        let key = requestKey, token = UUID(); request = token
        if loadedKey != key { films = []; offset = nil; loadedKey = key }
        loading = true; error = nil; defer { if request == token { loading = false } }
        do {
            if !query.isEmpty && !more { try await Task.sleep(for: .milliseconds(200)) }
            let result: SavedResult = try await state.api.get("library/saved", query: ["limit": "30", "offset": String(more ? offset ?? 0 : 0), "q": query])
            try Task.checkCancellation(); guard key == requestKey, request == token else { return }
            if more { let ids = Set(films.map(\.id)); films += result.films.filter { !ids.contains($0.id) } } else { films = result.films }
            offset = result.nextOffset
        } catch { if !Task.isCancelled && key == requestKey && request == token { films = []; offset = nil; self.error = error.localizedDescription } }
    }
}
