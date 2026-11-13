import SwiftUI
import MoodieCore

struct SavedResponseView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    let response: FilmResponse
    var suggestionId: Int?
    @State private var suggestion: FilmSuggestion?
    @State private var replyPresented = false
    @State private var suggestionError: String?
    @State private var nextFilm: Film?
    @State private var loading = true
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))) {
                    Label("Saved to your diary", systemImage: "checkmark.circle.fill").font(.subheadline.weight(.medium))
                    if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                    Label(response.visibility == "private" ? "Only me" : "Shared", systemImage: response.visibility == "private" ? "lock" : "globe")
                        .font(.caption).foregroundStyle(MoodieTheme.secondary)
                }.padding(.top, 12).accessibilityIdentifier("response-saved")
                VStack(alignment: .leading, spacing: 14) {
                    FilmRow(film: response.film)
                    if !response.note.isEmpty { Text(response.note).lineSpacing(3).lineLimit(3) }
                    FeelingTrace(feelings: response.feelings)
                    ResponseDetails(enjoyment: response.enjoyment, highlights: response.highlights ?? [])
                    NavigationLink(value: ResponseRoute(response: response)) {
                        HStack {
                            Text("Read your response")
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.caption)
                        }.font(.subheadline).frame(minHeight: 44)
                    }.accessibilityIdentifier("read-saved-response")
                }
                Divider()
                if let suggestion {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 10) {
                            Avatar(name: suggestion.senderUsername)
                            Text("Back to \(suggestion.senderUsername)").font(.system(.title2, design: .serif))
                        }
                        Text(suggestion.context).font(.subheadline).foregroundStyle(MoodieTheme.secondary).lineLimit(2)
                        if suggestion.reply == nil {
                            Button("Tell \(suggestion.senderUsername) how it landed", systemImage: "text.bubble") { replyPresented = true }
                                .buttonStyle(MoodieActionStyle()).accessibilityIdentifier("reply-after-save")
                            Text("Your diary note stays here. Write them a separate reply.").font(.caption).foregroundStyle(MoodieTheme.secondary)
                        }
                        NavigationLink(suggestion.reply == nil ? "Reply another time" : "Open your conversation", value: SuggestionRoute(id: suggestion.id))
                    }
                }
                if let suggestionError { InlineError(message: suggestionError) { Task { await loadSuggestion() } } }
                (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(spacing: 16))) {
                    Button("Open diary", systemImage: "book.closed") { state.selectedTab = .diary; dismiss() }
                        .buttonStyle(MoodieActionStyle(primary: false)).accessibilityIdentifier("open-diary-after-save")
                    if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                    if state.isSaved(response.movieId) {
                        Button("Unsave film", systemImage: "bookmark.slash") { Task { await state.toggleSaved(response.film) } }
                            .font(.caption).frame(minHeight: 44)
                            .disabled(state.isMutating.contains("save-\(response.movieId)"))
                    }
                }
                SavedStatusRecovery(ids: [response.movieId])
                if suggestionId == nil {
                    if let nextFilm {
                        Divider()
                        RecommendationCard(film: nextFilm)
                    } else if loading { ProgressView().frame(maxWidth: .infinity) }
                    else if let error {
                        InlineError(message: "Your response is saved. \(error)") { Task { await load() } }
                    } else {
                        Button("Explore people", systemImage: "person.2") { state.selectedTab = .people; dismiss() }
                            .font(.subheadline).frame(minHeight: 44)
                    }
                }
            }.padding(24).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle("Response saved").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.accessibilityIdentifier("finish-response") } }
            .task { await load() }
            .task(id: state.revision) { await loadSuggestion(); await state.loadSavedStatus([response.movieId]) }
            .sheet(isPresented: $replyPresented) { if let suggestion { SuggestionReplyView(suggestion: suggestion, response: response) } }
    }
    private func loadSuggestion() async {
        guard let suggestionId else { return }
        do {
            let result: SuggestionResult = try await state.api.get("suggestions/\(suggestionId)")
            suggestion = result.suggestion; suggestionError = nil
        } catch { if !Task.isCancelled { suggestionError = "Your viewing is saved. The recommendation couldn’t be opened yet." } }
    }
    private func load() async {
        guard suggestionId == nil else { loading = false; return }
        loading = true; error = nil; defer { loading = false }
        do {
            let result: Recommendations = try await state.api.send("recommendations", body: EmptyBody())
            try Task.checkCancellation(); nextFilm = result.forYou.first
        } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
}
