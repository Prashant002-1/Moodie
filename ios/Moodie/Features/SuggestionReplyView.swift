import SwiftUI
import MoodieCore

struct SuggestionReplyView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let suggestion: FilmSuggestion
    let response: FilmResponse
    @State private var enjoyment: Enjoyment?
    @State private var highlights: [ResponseHighlight] = []
    @State private var note = ""
    @State private var shareFeelings = false
    @State private var spoilers = false
    @State private var ready = false
    @State private var busy = false
    @State private var error: String?
    @State private var discard = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    HStack(spacing: 12) {
                        Avatar(name: suggestion.senderUsername, size: 40)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("For \(suggestion.senderUsername)").font(.headline)
                            Text(response.title).font(.system(.subheadline, design: .serif)).foregroundStyle(MoodieTheme.secondary)
                        }
                        Spacer(minLength: 0)
                        Poster(path: response.posterPath, width: 40, title: response.title)
                    }
                    DisclosureGroup("Their recommendation") {
                        Text(suggestion.context).font(.subheadline).foregroundStyle(MoodieTheme.secondary).padding(.top, 8)
                    }.font(.subheadline).tint(MoodieTheme.secondary)
                    WritingSection(title: "How did it land?") { EnjoymentPicker(value: $enjoyment) }
                    WritingSection(title: "Tell them what you thought") {
                        TextField("What would you tell \(suggestion.senderUsername)?", text: $note, axis: .vertical).lineLimit(4...10)
                            .font(.body).lineSpacing(4).padding(16)
                            .background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(MoodieTheme.rule, lineWidth: 0.6))
                            .accessibilityIdentifier("suggestion-reply-note")
                        Text("This is separate from your diary note.").font(.caption).foregroundStyle(MoodieTheme.secondary)
                        if note.count > 900 { Text("\(note.count)/1,000").font(.caption).foregroundStyle(note.count > 1000 ? .red : MoodieTheme.secondary) }
                    }
                    DisclosureGroup {
                        HighlightPicker(values: $highlights).padding(.top, 12)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("What stayed with you?").font(.subheadline.weight(.medium))
                            if !highlights.isEmpty { Text(highlights.map(\.title).joined(separator: " · ")).font(.caption).foregroundStyle(MoodieTheme.secondary) }
                        }.frame(minHeight: 44)
                    }.tint(MoodieTheme.secondary)
                    Divider()
                    VStack(spacing: 16) {
                        Toggle("Include my feelings", isOn: $shareFeelings)
                        if shareFeelings { FeelingTrace(feelings: response.feelings).frame(maxWidth: .infinity, alignment: .leading) }
                        Toggle("Contains spoilers", isOn: $spoilers)
                    }.font(.subheadline)
                    DisclosureGroup("Preview reply") {
                        VStack(alignment: .leading, spacing: 12) {
                            ResponseDetails(enjoyment: enjoyment, highlights: highlights)
                            if !note.isEmpty { Text(note) }
                            if shareFeelings { FeelingTrace(feelings: response.feelings) }
                            if spoilers { Label("Marked as spoilers", systemImage: "eye.slash").font(.caption) }
                            if enjoyment == nil { Text("Choose how it landed to send your reply.").foregroundStyle(MoodieTheme.secondary) }
                        }.padding(.vertical, 12)
                    }.font(.subheadline).tint(MoodieTheme.secondary)
                    if let error { InlineError(message: error) }
                }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
            }.disabled(busy).scrollDismissesKeyboard(.interactively).moodieScreen()
                .navigationTitle("For \(suggestion.senderUsername)").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { if note.isEmpty { dismiss() } else { discard = true } }.disabled(busy) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(suggestion.reply == nil ? "Send reply" : "Update reply") { Task { await send() } }.bold()
                            .disabled(enjoyment == nil || note.count > 1000 || busy).accessibilityIdentifier("send-recommendation-reply")
                    }
                }.interactiveDismissDisabled(busy || !note.isEmpty)
                .confirmationDialog("Discard this reply?", isPresented: $discard, titleVisibility: .visible) {
                    Button("Discard changes", role: .destructive) { dismiss() }; Button("Keep writing", role: .cancel) { }
                }
                .onAppear {
                    guard !ready else { return }; ready = true
                    enjoyment = suggestion.reply?.enjoyment ?? response.enjoyment
                    highlights = suggestion.reply?.highlights ?? response.highlights ?? []
                    note = suggestion.reply?.note ?? ""
                    shareFeelings = suggestion.reply?.feelings != nil; spoilers = suggestion.reply?.containsSpoilers ?? false
                }
        }
    }
    private func send() async {
        guard let enjoyment, !busy else { return }; busy = true; error = nil; defer { busy = false }
        do {
            let _: SuggestionResult = try await state.api.send("suggestions/\(suggestion.id)/reply", method: "PUT",
                body: SuggestionReplyInput(entryId: response.id, enjoyment: enjoyment, highlights: highlights, note: note, shareFeelings: shareFeelings, containsSpoilers: spoilers))
            state.revision += 1; dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
