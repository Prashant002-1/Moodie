import SwiftUI
import MoodieCore

struct SuggestionsHomeSection: View {
    @Environment(AppState.self) private var state
    @State private var items: [FilmSuggestion] = []
    @State private var error: String?
    @State private var loaded = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let first = items.first(where: { $0.origin == "sent" && $0.reply == nil }) ?? items.first {
                HStack {
                    Text("Recommended to you").font(.subheadline.weight(.semibold))
                    Spacer()
                    NavigationLink("See all", value: SuggestionsRoute()).font(.caption.weight(.medium)).frame(minHeight: 44)
                }
                NavigationLink(value: SuggestionRoute(id: first.id)) {
                    HStack(alignment: .top, spacing: 14) {
                        Poster(path: first.posterPath, width: 48, title: first.title)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(first.title).font(.system(.headline, design: .serif))
                            Text(first.origin == "sent" ? "From \(first.senderUsername)" : "Through \(first.senderUsername)")
                                .font(.caption.weight(.medium)).foregroundStyle(MoodieTheme.secondary)
                            Text(first.context).font(.subheadline).foregroundStyle(MoodieTheme.secondary).lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).foregroundStyle(MoodieTheme.secondary).padding(.top, 6)
                    }.contentShape(Rectangle())
                }.buttonStyle(.plain)
                Divider().padding(.top, 10)
            } else if loaded && error == nil {
                HStack(spacing: 14) {
                    Image(systemName: "paperplane").font(.title3).foregroundStyle(MoodieTheme.accent)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("A film made you think of someone?").font(.subheadline.weight(.medium))
                        RecommendFilmButton(title: "Send them a recommendation")
                    }
                }
            }
            if let error { InlineError(message: error) { Task { await load() } } }
        }.task(id: state.revision) { await load() }
    }
    private func load() async {
        do {
            let result: SuggestionsPage = try await state.api.get("suggestions", query: ["limit": "3"])
            try Task.checkCancellation(); items = result.suggestions; error = nil; loaded = true
        } catch { if !Task.isCancelled { self.error = "Recommendations couldn’t be loaded." } }
    }
}

struct SuggestionsView: View {
    @Environment(AppState.self) private var state
    var personId: Int?
    var personName: String?
    @State private var box = "received"
    @State private var query = ""
    @State private var items: [FilmSuggestion] = []
    @State private var offset: Int?
    @State private var loading = false
    @State private var error: String?
    private var key: String { "\(box)-\(query)-\(state.revision)" }
    var body: some View {
        List {
            Section {
                ReadingTabs(choices: ["For you", "From you", "Archived"], selection: Binding(
                    get: { box == "sent" ? "From you" : box == "archived" ? "Archived" : "For you" },
                    set: { box = $0 == "From you" ? "sent" : $0 == "Archived" ? "archived" : "received" }))
                    .listRowSeparator(.hidden)
            }.listRowBackground(Color.clear)
            ForEach(items) { item in
                NavigationLink(value: SuggestionRoute(id: item.id)) { SuggestionRow(suggestion: item) }
                    .listRowBackground(Color.clear).accessibilityIdentifier("suggestion-\(item.id)")
            }
            if let offset { Button("More recommendations") { Task { await load(offset: offset) } }.disabled(loading).listRowBackground(Color.clear) }
            if loading { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if let error { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
            if !loading && error == nil && items.isEmpty {
                ContentUnavailableView {
                    Label(query.isEmpty ? (box == "sent" ? "A film made you think of someone?" : box == "archived" ? "Nothing set aside" : "A film, with someone behind it") : "No matching recommendations", systemImage: "text.bubble")
                } description: {
                    Text(query.isEmpty ? (box == "sent" ? "Recommend a film with a reason just for them. Their reply will come back here." : box == "archived" ? "Set a recommendation aside whenever you like. You can return to it here." : "Recommendations people send you and films you keep through their responses live here, with the reason you wanted to watch.") : "Search a title, person, or reason.")
                } actions: {
                    if box == "sent" { RecommendFilmButton() }
                    else if box == "received" { Button("Explore people") { state.selectedTab = .people } }
                }.listRowBackground(Color.clear).listRowSeparator(.hidden)
            }
        }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
            .navigationTitle(personName.map { "You & \($0)" } ?? "Recommendations")
            .navigationBarTitleDisplayMode(.inline).searchable(text: $query, prompt: "Title, person, or reason")
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                RecommendFilmButton(iconOnly: true)
            } }
            .task(id: key) { await load() }.refreshable { await load() }
    }
    private func load(offset: Int = 0) async {
        let current = key
        loading = true; error = nil
        defer { if current == key { loading = false } }
        do {
            if offset == 0 { try await Task.sleep(for: .milliseconds(200)) }
            var params = ["box": box, "q": query, "offset": String(offset)]
            if let personId { params["personId"] = String(personId) }
            let page: SuggestionsPage = try await state.api.get("suggestions", query: params)
            try Task.checkCancellation(); guard current == key else { return }
            if offset == 0 { items = page.suggestions }
            else { let ids = Set(items.map(\.id)); items += page.suggestions.filter { !ids.contains($0.id) } }
            self.offset = page.nextOffset
        } catch { if !Task.isCancelled && current == key { self.error = error.localizedDescription } }
    }
}

struct SuggestionRow: View {
    @Environment(AppState.self) private var state
    let suggestion: FilmSuggestion
    private var received: Bool { suggestion.recipientId == state.user?.id }
    var body: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 7) {
                    Avatar(name: received ? suggestion.senderUsername : suggestion.recipientUsername, size: 24)
                    Text(received ? (suggestion.origin == "sent" ? "From \(suggestion.senderUsername)" : "Through \(suggestion.senderUsername)") : "For \(suggestion.recipientUsername)")
                        .font(.caption.weight(.medium)).foregroundStyle(MoodieTheme.secondary)
                }
                Text(suggestion.title).font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
                Text(suggestion.context).font(.subheadline).lineSpacing(3).lineLimit(3)
                HStack(spacing: 5) {
                    if let reply = suggestion.reply {
                        Image(systemName: "bubble.left.and.bubble.right").font(.caption2)
                        Text("\(received ? "You" : suggestion.recipientUsername): \(reply.enjoyment.title.lowercased())")
                    } else { Text(suggestion.statusTitle) }
                }.font(.caption).foregroundStyle(MoodieTheme.secondary)
            }.frame(maxWidth: .infinity, alignment: .leading)
            Poster(path: suggestion.posterPath, width: 64, title: suggestion.title).padding(.top, 3)
        }.foregroundStyle(MoodieTheme.ink).padding(.vertical, 10)
    }
}

struct KeepRecommendationButton: View {
    @Environment(AppState.self) private var state
    let sourceEntryId: Int
    var compact = false
    private var keptId: Int? { state.keptRecommendations[sourceEntryId] }
    @State private var busy = false
    var body: some View {
        if let keptId {
            NavigationLink(value: SuggestionRoute(id: keptId)) {
                Label(compact ? "Saved" : "Recommendation saved", systemImage: "bookmark.fill")
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            }.font(.subheadline)
                .accessibilityLabel("Open saved recommendation")
        } else {
            Button { Task { await keep() } } label: {
                Label(compact ? "Keep" : "Keep recommendation", systemImage: "bookmark")
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            }.font(.subheadline).disabled(busy)
                .accessibilityLabel("Keep recommendation")
                .accessibilityIdentifier("keep-recommendation-\(sourceEntryId)")
        }
    }
    private func keep() async {
        busy = true; defer { busy = false }
        do {
            let result: SuggestionResult = try await state.api.send("suggestions", body: SuggestionInput(sourceEntryId: sourceEntryId))
            state.keptRecommendations[sourceEntryId] = result.suggestion.id; await state.refreshSaved(); state.revision += 1
        } catch { state.handle(error) }
    }
}

/// Embedded on films and responses so attribution remains reachable outside the inbox.
struct SuggestionsForFilm: View {
    @Environment(AppState.self) private var state
    let movieId: Int
    var entryId: Int?
    @State private var items: [FilmSuggestion] = []
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !items.isEmpty {
                Text(entryId == nil ? "People behind this film" : "How this film found you").font(.headline)
                ForEach(items) { item in
                    NavigationLink(value: SuggestionRoute(id: item.id)) {
                        HStack(alignment: .top, spacing: 12) {
                            Avatar(name: item.senderUsername)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.origin == "sent" ? "\(item.senderUsername) recommended this" : "Found through \(item.senderUsername)").font(.subheadline.weight(.medium))
                                Text(item.context).font(.subheadline).foregroundStyle(MoodieTheme.secondary).lineLimit(3)
                                Text(item.statusTitle).font(.caption).foregroundStyle(MoodieTheme.accent)
                            }
                        }
                    }.buttonStyle(.plain)
                }
            }
            if let error { InlineError(message: error) { Task { await load() } } }
        }.task(id: "\(movieId)-\(entryId ?? 0)-\(state.revision)") { await load() }
    }
    private func load() async {
        do {
            var params = ["movieId": String(movieId)]
            if let entryId { params["entryId"] = String(entryId) }
            let result: SuggestionsPage = try await state.api.get("suggestions", query: params)
            try Task.checkCancellation(); items = result.suggestions; error = nil
        } catch { if !Task.isCancelled { self.error = "Recommendations couldn’t be loaded. Try again." } }
    }
}
