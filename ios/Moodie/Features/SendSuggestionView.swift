import SwiftUI
import MoodieCore

struct RecommendFilmButton: View {
    var title = "Recommend a film"
    var film: Film?
    var recipient: Member?
    var sourceEntryId: Int?
    var iconOnly = false
    @State private var presented = false
    var body: some View {
        Button { presented = true } label: {
            Group {
                if iconOnly { Image(systemName: "paperplane").font(.system(size: 21)) }
                else { Label(title, systemImage: "paperplane") }
            }.frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
        }.accessibilityLabel(title)
            .sheet(isPresented: $presented) {
                SendSuggestionView(request: SuggestionComposerRequest(film: film, recipient: recipient, sourceEntryId: sourceEntryId))
            }
    }
}

struct SendSuggestionView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let request: SuggestionComposerRequest
    @State private var film: Film?
    @State private var recipient: Member?
    @State private var reason = ""
    @State private var chooseFilm = false
    @State private var choosePerson = false
    @State private var discard = false
    @State private var busy = false
    @State private var error: String?
    @State private var sent: FilmSuggestion?
    private var valid: Bool { film != nil && recipient != nil && !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && reason.count <= 1000 }
    var body: some View {
        NavigationStack {
            if let sent {
                VStack(alignment: .leading, spacing: 24) {
                    PageHeading(title: "A film for \(sent.recipientUsername)", subtitle: sent.reason == reason.trimmingCharacters(in: .whitespacesAndNewlines) ? "Your recommendation is sent." : "You’ve already recommended this film. Your original note is below.")
                    FilmRow(film: sent.film)
                    Text(sent.reason).font(.body)
                    NavigationLink("Open your recommendation", value: SuggestionRoute(id: sent.id)).buttonStyle(.borderedProminent)
                    Spacer()
                }.padding(24).moodieScreen().navigationTitle("Sent").navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                    .appDestinations().accessibilityIdentifier("suggestion-sent")
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        if let film {
                            HStack(alignment: .center, spacing: 18) {
                                Poster(path: film.posterPath, width: 78, title: film.title)
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(film.title).font(.system(.title2, design: .serif))
                                    Text(film.year).font(.caption).foregroundStyle(MoodieTheme.secondary)
                                    Button("Change film") { chooseFilm = true }.font(.subheadline).frame(minHeight: 44)
                                }
                                Spacer(minLength: 0)
                            }
                        } else {
                            Button("Choose a film", systemImage: "magnifyingglass") { chooseFilm = true }.buttonStyle(MoodieActionStyle(primary: false))
                        }
                        Divider()
                        HStack(spacing: 12) {
                            Text("To").font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                            if let recipient {
                                Avatar(name: recipient.username, size: 30)
                                Button { choosePerson = true } label: {
                                    HStack { Text(recipient.username).fontWeight(.medium); Image(systemName: "chevron.down").font(.caption2) }
                                }.tint(MoodieTheme.ink).frame(minHeight: 44).accessibilityLabel("Choose someone else")
                            } else { Button("Who is this for?") { choosePerson = true }.frame(minHeight: 44) }
                            Spacer()
                        }
                        WritingSection(title: "Why this film, for them?") {
                            TextField("Thought of you because…", text: $reason, axis: .vertical).lineLimit(6...12)
                                .font(.body).lineSpacing(5).padding(18)
                                .background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(MoodieTheme.rule, lineWidth: 0.6))
                                .accessibilityIdentifier("suggestion-reason")
                            HStack {
                                Text("A note between you two.")
                                Spacer()
                                if reason.count > 900 { Text("\(reason.count)/1,000").foregroundStyle(reason.count > 1000 ? .red : MoodieTheme.secondary) }
                            }.font(.caption).foregroundStyle(MoodieTheme.secondary)
                        }
                        if let error { InlineError(message: error) }
                    }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
                }.disabled(busy).moodieScreen().scrollDismissesKeyboard(.interactively)
                    .navigationTitle("Recommend a film").navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { if reason.isEmpty { dismiss() } else { discard = true } }.disabled(busy) }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Send") { Task { await send() } }.bold().disabled(!valid || busy).accessibilityIdentifier("send-suggestion")
                        }
                    }.interactiveDismissDisabled(!reason.isEmpty || busy)
                    .confirmationDialog("Discard this recommendation?", isPresented: $discard, titleVisibility: .visible) {
                        Button("Discard", role: .destructive) { dismiss() }; Button("Keep writing", role: .cancel) { }
                    }
                    .sheet(isPresented: $chooseFilm) {
                        NavigationStack {
                            SearchView(selectFilm: { film = $0; chooseFilm = false })
                                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { chooseFilm = false } } }
                        }
                    }
                    .sheet(isPresented: $choosePerson) { SuggestionRecipientPicker { recipient = $0; choosePerson = false } }
                    .onAppear { if film == nil { film = request.film }; if recipient == nil { recipient = request.recipient } }
            }
        }
    }
    private func send() async {
        guard let film, let recipient, valid, !busy else { return }
        busy = true; error = nil; defer { busy = false }
        do {
            let result: SuggestionResult = try await state.api.send("suggestions", body: SuggestionInput(movieId: film.id, recipientId: recipient.id, reason: reason,
                sourceEntryId: film.id == request.film?.id ? request.sourceEntryId : nil))
            sent = result.suggestion; state.revision += 1
        } catch { self.error = error.localizedDescription }
    }
}

struct SuggestionRecipientPicker: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let select: (Member) -> Void
    @State private var query = ""
    @State private var people: [Member] = []
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            List {
                ForEach(people) { person in
                    Button { select(person) } label: { HStack(spacing: 12) { Avatar(name: person.username); Text(person.username).foregroundStyle(MoodieTheme.ink) }.frame(minHeight: 44) }
                        .listRowBackground(Color.clear).accessibilityIdentifier("recipient-\(person.username)")
                }
                if loading { ProgressView() }
                if let error { InlineError(message: error) { Task { await load() } } }
                if !loading && error == nil && people.isEmpty {
                    ContentUnavailableView("No people to show", systemImage: "person.2", description: Text("People who follow you can receive recommendations. You can also keep a film through any shared response."))
                }
            }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
                .navigationTitle("Choose a person").navigationBarTitleDisplayMode(.inline).searchable(text: $query, prompt: "Find a follower")
                .task(id: query) { await load() }
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
    private func load() async {
        loading = true; error = nil; defer { if !Task.isCancelled { loading = false } }
        do {
            try await Task.sleep(for: .milliseconds(200))
            let result: PeopleResult = try await state.api.get("suggestions/recipients", query: ["q": query])
            try Task.checkCancellation(); people = result.people
        } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
}
