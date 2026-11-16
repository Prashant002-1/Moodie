import SwiftUI
import MoodieCore

struct SuggestionDetailView: View {
    @Environment(AppState.self) private var state
    let id: Int
    @State private var suggestion: FilmSuggestion?
    @State private var messages: [SuggestionMessage] = []
    @State private var messagesOffset: Int?
    @State private var loading = false
    @State private var busy = false
    @State private var error: String?
    @State private var writingReply: FilmResponse?
    @State private var choosingViewing = false
    @State private var message = ""
    @State private var messageSpoilers = false
    @State private var messageKey = UUID().uuidString
    @State private var sendingMessage = false
    @State private var removeReply = false
    @State private var reporting = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let item = suggestion {
                    heading(item)
                    Divider()
                    if item.recipientId == state.user?.id { recipientActions(item) }
                    if let reply = item.reply { replyContent(reply, item: item); Divider() }
                    if item.canConverse { conversation(item) }
                    RecommendFilmButton(title: "Recommend this to someone", film: item.film)
                }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                if let error { InlineError(message: error) { Task { await load() } } }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle(suggestion?.title ?? "Recommendation").navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .safeAreaInset(edge: .bottom) {
                if suggestion?.canConverse == true { messageComposer }
            }
            .onChange(of: message) { _, _ in messageKey = UUID().uuidString }
            .onChange(of: messageSpoilers) { _, _ in messageKey = UUID().uuidString }
            .task(id: state.revision) { await load() }.refreshable { await load() }
            .sheet(item: $writingReply) { response in
                if let suggestion { SuggestionReplyView(suggestion: suggestion, response: response) }
            }
            .sheet(isPresented: $choosingViewing) {
                if let suggestion { SuggestionViewingPicker(suggestion: suggestion) { response in
                    choosingViewing = false
                    Task { await link(response) }
                } }
            }
            .confirmationDialog("Remove your reply?", isPresented: $removeReply, titleVisibility: .visible) {
                Button("Remove reply", role: .destructive) { Task { await retractReply() } }
            } message: { Text("The enjoyment, note, highlights, and shared feelings in this reply will be removed. Your diary stays as it is. Messages in the conversation stay until their author deletes them.") }
            .toolbar { if let item = suggestion {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if item.recipientId == state.user?.id {
                            Button(item.archived ? "Restore recommendation" : "Archive recommendation", systemImage: item.archived ? "tray.and.arrow.up" : "archivebox") {
                                Task { await update(item.archived ? "restore" : "archive") }
                            }
                            if item.reply != nil { Button("Remove my reply", role: .destructive) { removeReply = true } }
                        }
                        Button("Report person", systemImage: "flag") { reporting = true }
                    } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.accessibilityLabel("Recommendation options").disabled(busy)
                }
            } }
            .sheet(isPresented: $reporting) { if let item = suggestion {
                let person = item.recipientId == state.user?.id ? item.senderId : item.recipientId
                ReportView(target: .person(person), personID: person)
            } }
    }

    private func heading(_ item: FilmSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            let received = item.recipientId == state.user?.id
            NavigationLink(value: MemberRoute(username: received ? item.senderUsername : item.recipientUsername)) {
                HStack(spacing: 10) {
                    Avatar(name: received ? item.senderUsername : item.recipientUsername, size: 34)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(received ? (item.origin == "sent" ? "\(item.senderUsername) thought of you" : "Found through \(item.senderUsername)") : (item.origin == "sent" ? "You thought of \(item.recipientUsername)" : "\(item.recipientUsername) found this through you"))
                            .font(.subheadline.weight(.semibold))
                        Text(Day.timestamp(from: item.createdAt) ?? Date(), format: .dateTime.month(.abbreviated).day()).font(.caption).foregroundStyle(MoodieTheme.secondary)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption2).foregroundStyle(MoodieTheme.secondary)
                }
            }.buttonStyle(.plain)
            NavigationLink(value: item.film) {
                HStack(alignment: .center, spacing: 20) {
                    VStack(alignment: .leading, spacing: 9) {
                        Text(item.title).font(.system(.largeTitle, design: .serif)).tracking(-0.7).fixedSize(horizontal: false, vertical: true)
                        Text(item.film.year).font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    Poster(path: item.posterPath, width: 88, title: item.title)
                }
            }.buttonStyle(.plain)
            Text(item.context).font(.system(.title3, design: .serif)).lineSpacing(5).textSelection(.enabled)
            if item.origin == "discovered" && !item.canConverse {
                Text("Kept from their response. Only you can see this.").font(.caption).foregroundStyle(MoodieTheme.secondary)
            }
            HStack(alignment: .firstTextBaseline) {
                Text(item.archived ? "Archived" : item.statusTitle).font(.caption).foregroundStyle(MoodieTheme.secondary)
                Spacer(minLength: 8)
                if let source = item.sourceEntryId {
                    NavigationLink("Their response", value: ActivityResponseRoute(id: source)).font(.caption.weight(.medium)).frame(minHeight: 44)
                }
            }
        }
    }

    private func recipientActions(_ item: FilmSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let entry = item.linkedEntryId {
                NavigationLink("Read your viewing", value: ActivityResponseRoute(id: entry))
                if item.reply == nil { Button("Change linked viewing") { choosingViewing = true }.font(.subheadline) }
                Button(item.reply == nil ? "Tell \(item.senderUsername) how it landed" : "Edit your reply", systemImage: "text.bubble") {
                    Task { await openReply(entry: entry) }
                }.buttonStyle(MoodieActionStyle()).disabled(busy).accessibilityIdentifier("reply-to-recommendation")
                if item.reply == nil { Text("Your viewing is private to you here until you choose what to send.").font(.caption).foregroundStyle(MoodieTheme.secondary) }
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { viewingButtons(item) }
                    VStack(alignment: .leading, spacing: 12) { viewingButtons(item) }
                }
                Button("Link an existing viewing") { choosingViewing = true }.font(.subheadline).frame(minHeight: 44)
            }
        }
    }
    @ViewBuilder private func viewingButtons(_ item: FilmSuggestion) -> some View {
        SavedStatusRecovery(ids: [item.movieId])
        Button("I watched it", systemImage: "square.and.pencil") { state.composer = ComposerRequest(film: item.film, suggestion: item) }
            .buttonStyle(MoodieActionStyle()).accessibilityIdentifier("watch-suggestion")
        Button(state.savedStatus[item.movieId] == nil ? "Checking saved films" : state.isSaved(item.movieId) ? "Saved for later" : "Save for later", systemImage: state.isSaved(item.movieId) ? "bookmark.fill" : "bookmark") {
            Task { await update("save") }
        }.buttonStyle(MoodieActionStyle(primary: false)).disabled(busy || state.savedStatus[item.movieId] == nil || state.isSaved(item.movieId))
    }

    private func replyContent(_ reply: SuggestionReply, item: FilmSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(item.recipientId == state.user?.id ? "Your reply" : "\(item.recipientUsername)’s reply")
                .font(.title3.weight(.semibold))
            SpoilerContent(hidden: reply.containsSpoilers && item.recipientId != state.user?.id) {
                VStack(alignment: .leading, spacing: 12) {
                    ResponseDetails(enjoyment: reply.enjoyment, highlights: reply.highlights)
                    if !reply.note.isEmpty { Text(reply.note).lineSpacing(3).textSelection(.enabled) }
                    if let feelings = reply.feelings { FeelingTrace(feelings: feelings) }
                }
                if let theirs = item.sourceFeelings, let received = reply.feelings {
                    DisclosureGroup("Two ways this film felt") {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(item.senderUsername).font(.subheadline.weight(.medium)); FeelingTrace(feelings: theirs)
                            Text(item.recipientUsername).font(.subheadline.weight(.medium)); FeelingTrace(feelings: received)
                        }.padding(.top, 12)
                    }.font(.subheadline)
                }
            }
        }
    }

    private func conversation(_ item: FilmSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !messages.isEmpty { Text("Conversation").font(.headline) }
            ForEach(messages) { message in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(message.userId == state.user?.id ? "You" : message.username).font(.subheadline.weight(.semibold))
                        Spacer()
                        if message.userId == state.user?.id {
                            Menu { Button("Delete message", role: .destructive) { Task { await deleteMessage(message) } } }
                            label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.accessibilityLabel("Message options")
                        }
                    }
                    SpoilerContent(hidden: message.containsSpoilers && message.userId != state.user?.id) { Text(message.body).textSelection(.enabled) }
                }.padding(.vertical, 4)
                Divider()
            }
            if let messagesOffset { Button("More messages") { Task { await loadMessages(offset: messagesOffset) } }.disabled(busy) }
        }
    }
    private var messageComposer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if messageSpoilers { Label("Spoilers hidden until opened", systemImage: "eye.slash").font(.caption).foregroundStyle(MoodieTheme.secondary) }
            HStack(alignment: .bottom, spacing: 10) {
                Menu {
                    Toggle("Contains spoilers", isOn: $messageSpoilers)
                } label: {
                    Image(systemName: messageSpoilers ? "eye.slash" : "ellipsis").frame(width: 36, height: 44)
                }.accessibilityLabel("Message options").disabled(sendingMessage)
                TextField("Talk about the film…", text: $message, axis: .vertical).lineLimit(1...5)
                    .font(.body).padding(.vertical, 12).accessibilityIdentifier("recommendation-message").disabled(sendingMessage)
                Button { Task { await sendMessage() } } label: {
                    Image(systemName: "arrow.up").font(.body.weight(.semibold)).frame(width: 44, height: 44)
                        .foregroundStyle(MoodieTheme.canvas).background(MoodieTheme.ink, in: Circle())
                }.buttonStyle(.plain).disabled(sendingMessage || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || message.count > 1000)
                    .opacity(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.3 : 1)
                    .accessibilityLabel("Send message").accessibilityIdentifier("send-recommendation-message")
            }
            if message.count > 900 { Text("\(message.count)/1,000").font(.caption).foregroundStyle(message.count > 1000 ? .red : MoodieTheme.secondary) }
        }.padding(.horizontal, 16).padding(.vertical, 10).background(.bar)
    }
    private func load() async {
        loading = true; error = nil; defer { if !Task.isCancelled { loading = false } }
        do {
            let result: SuggestionResult = try await state.api.get("suggestions/\(id)")
            try Task.checkCancellation(); suggestion = result.suggestion
            await state.loadSavedStatus([result.suggestion.movieId])
            if result.suggestion.canConverse { await loadMessages() }
            else { messages = []; messagesOffset = nil }
        } catch { if !Task.isCancelled { self.error = error.localizedDescription; suggestion = nil; messages = [] } }
    }
    private func loadMessages(offset: Int = 0) async {
        do {
            let page: SuggestionMessagesPage = try await state.api.get("suggestions/\(id)/messages", query: ["offset": String(offset)])
            try Task.checkCancellation()
            if offset == 0 { messages = page.messages } else { let ids = Set(messages.map(\.id)); messages += page.messages.filter { !ids.contains($0.id) } }
            messagesOffset = page.nextOffset
        } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
    private func update(_ action: String) async {
        busy = true; defer { busy = false }
        do {
            let result: SuggestionResult = try await state.api.send("suggestions/\(id)", method: "PATCH", body: SuggestionAction(action))
            suggestion = result.suggestion; await state.refreshSaved(); state.revision += 1
        } catch { self.error = error.localizedDescription }
    }
    private func link(_ response: FilmResponse) async {
        busy = true; defer { busy = false }
        do {
            let result: SuggestionResult = try await state.api.send("suggestions/\(id)", method: "PATCH", body: SuggestionAction("link", entryId: response.id))
            suggestion = result.suggestion; state.revision += 1
        } catch { self.error = error.localizedDescription }
    }
    private func openReply(entry: Int) async {
        busy = true; defer { busy = false }
        do {
            let result: ResponseResult = try await state.api.get("discovery/entries/\(entry)")
            writingReply = result.entry
        } catch { self.error = error.localizedDescription }
    }
    private func retractReply() async {
        busy = true; defer { busy = false }
        do { try await state.api.mutate("suggestions/\(id)/reply", method: "DELETE", body: EmptyBody()); state.revision += 1 }
        catch { self.error = error.localizedDescription }
    }
    private func sendMessage() async {
        sendingMessage = true; error = nil; defer { sendingMessage = false }
        do {
            try await state.api.mutate("suggestions/\(id)/messages", body: SuggestionMessageInput(body: message, clientRequestId: messageKey, containsSpoilers: messageSpoilers))
            message = ""; messageSpoilers = false; messageKey = UUID().uuidString
            await loadMessages(); state.revision += 1
        } catch { self.error = error.localizedDescription }
    }
    private func deleteMessage(_ message: SuggestionMessage) async {
        do { try await state.api.mutate("suggestions/\(id)/messages/\(message.id)", method: "DELETE", body: EmptyBody()); await loadMessages() }
        catch { self.error = error.localizedDescription }
    }
}

struct SpoilerContent<Content: View>: View {
    let hidden: Bool
    @ViewBuilder let content: () -> Content
    @State private var revealed = false
    var body: some View {
        if hidden && !revealed { Button("Show spoilers", systemImage: "eye") { revealed = true }.frame(minHeight: 44) }
        else { content() }
    }
}

struct SuggestionViewingPicker: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let suggestion: FilmSuggestion
    let select: (FilmResponse) -> Void
    @State private var entries: [FilmResponse] = []
    @State private var offset: Int?
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            List {
                ForEach(entries) { response in Button { select(response) } label: { DiaryEntryRow(response: response) }.buttonStyle(.plain).listRowBackground(Color.clear) }
                if let offset { Button("Earlier viewings") { Task { await load(offset: offset) } }.disabled(loading) }
                if loading { ProgressView() }
                if let error { InlineError(message: error) { Task { await load() } } }
                if !loading && error == nil && entries.isEmpty { ContentUnavailableView("No viewing yet", systemImage: "book.closed", description: Text("Add your response to \(suggestion.title), then let \(suggestion.senderUsername) know how it landed.")) }
            }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen().navigationTitle("Choose your viewing").navigationBarTitleDisplayMode(.inline)
                .task { await load() }.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
    private func load(offset: Int = 0) async {
        loading = true; error = nil; defer { loading = false }
        do {
            let page: DiaryPage = try await state.api.get("diary", query: ["movieId": String(suggestion.movieId), "offset": String(offset)])
            entries = offset == 0 ? page.entries : entries + page.entries; self.offset = page.nextOffset
        } catch { self.error = error.localizedDescription }
    }
}
