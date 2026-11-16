import SwiftUI
import PhotosUI
import MoodieCore

struct ComposerView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    let request: ComposerRequest
    @State private var draft = ResponseDraft()
    @State private var original = ResponseDraft()
    @State private var ready = false
    @State private var finished = false
    @State private var choosingFilm = false
    @State private var busy = false
    @State private var error: String?
    @State private var closeOptions = false
    @State private var savedDraft: ResponseDraft?
    @State private var draftChoice = false
    @State private var photo: PhotosPickerItem?
    @State private var loadingPhoto = false
    @State private var savedResponse: FilmResponse?
    @State private var suggestions: [FilmSuggestion] = []
    @State private var suggestionError: String?
    @FocusState private var writing: Bool
    private var dirty: Bool { draft != original }
    var body: some View {
        let photoLabel = draft.expressionImage == nil ? "Add a photo" : "Replace photo"
        NavigationStack {
            if let savedResponse { SavedResponseView(response: savedResponse, suggestionId: draft.suggestionId).appDestinations() }
            else {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    if let film = draft.film {
                        HStack(alignment: .top, spacing: 18) {
                            Poster(path: film.posterPath, width: 70, title: film.title)
                            VStack(alignment: .leading, spacing: 8) {
                                QuietLabel(text: "Your viewing")
                                Text(film.title).font(.system(.title2, design: .serif)).fixedSize(horizontal: false, vertical: true)
                                Text(film.year).font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                                if draft.editingID == nil { Button("Change film") { choosingFilm = true }.font(.caption).frame(minHeight: 30) }
                            }
                            Spacer(minLength: 0)
                        }
                    } else {
                        Button("Choose a film", systemImage: "magnifyingglass") { choosingFilm = true }
                            .buttonStyle(MoodieActionStyle(primary: false))
                    }
                    if draft.editingID == nil && (!suggestions.isEmpty || draft.suggestionId != nil) {
                        VStack(alignment: .leading, spacing: 8) {
                            Picker("Recommended by", selection: $draft.suggestionId) {
                                Text("Found it myself").tag(Int?.none)
                                ForEach(suggestions.filter { $0.reply == nil }) { item in
                                    Text("\(item.origin == "sent" ? "From" : "Through") \(item.senderUsername)").tag(Optional(item.id))
                                }
                                if let id = draft.suggestionId, !suggestions.contains(where: { $0.id == id && $0.reply == nil }) {
                                    Text("Through \(draft.suggestionName ?? "a recommendation")").tag(Optional(id))
                                }
                            }.font(.subheadline).tint(MoodieTheme.ink)
                            if let selected = suggestions.first(where: { $0.id == draft.suggestionId }) {
                                Text(selected.context).font(.subheadline).foregroundStyle(MoodieTheme.secondary).lineLimit(3)
                            }
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading)
                            .background(MoodieTheme.ink.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
                    }
                    if let suggestionError { Text(suggestionError).font(.caption).foregroundStyle(MoodieTheme.secondary) }
                    WritingSection(title: "Your response") {
                        TextField("What will you remember?", text: $draft.note, axis: .vertical)
                            .font(.body).lineSpacing(5).lineLimit(4...12).focused($writing)
                            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(MoodieTheme.rule, lineWidth: 0.6))
                            .accessibilityIdentifier("response-note")
                        if draft.note.count > 1800 {
                            Text("\(draft.note.count)/2,000").font(.caption).foregroundStyle(draft.note.count > 2000 ? .red : MoodieTheme.secondary)
                        }
                    }
                    WritingSection(title: "How did it feel?") {
                        FeelingPicker(feelings: $draft.feelings)
                        if !draft.feelings.hasSelection { Text("Choose the feelings that stayed.").font(.caption).foregroundStyle(MoodieTheme.secondary) }
                    }
                    Divider()
                    WritingSection(title: "Did it work for you?", hint: "Optional") { EnjoymentPicker(value: $draft.enjoyment) }
                    DisclosureGroup {
                        HighlightPicker(values: Binding(get: { draft.highlights ?? [] }, set: { draft.highlights = $0 })).padding(.top, 12)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("What stayed with you?").font(.headline)
                            if let highlights = draft.highlights, !highlights.isEmpty {
                                Text(highlights.map(\.title).joined(separator: " · ")).font(.caption).foregroundStyle(MoodieTheme.secondary)
                            }
                        }.frame(minHeight: 44)
                    }.tint(MoodieTheme.secondary)
                    Divider()
                    VStack(spacing: 12) {
                        DatePicker("Watched on", selection: Binding(get: { Day.date(from: draft.watchedOn) ?? Date() },
                            set: { draft.watchedOn = Day.string(from: $0) }), in: ...Date(), displayedComponents: .date)
                        HStack {
                            Label(draft.visibility == "private" ? "Only me" : "Everyone", systemImage: draft.visibility == "private" ? "lock" : "globe")
                            Spacer()
                            Picker("Who can see this?", selection: $draft.visibility) {
                                Text("Only me").tag("private"); Text("Everyone").tag("public")
                            }.labelsHidden()
                        }
                        if let image = draft.expressionImage {
                            ResponsePhoto(path: image, alt: "Your selected expression photo").frame(maxHeight: 180)
                            Button("Remove photo", role: .destructive) { draft.expressionImage = nil; photo = nil }
                        }
                        PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                            Label(photoLabel, systemImage: "photo").frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }.disabled(loadingPhoto)
                        if loadingPhoto { ProgressView("Preparing photo…") }
                    }.font(.subheadline)
                    if draft.suggestionId != nil {
                        Text("After saving, you can choose a separate reply for \(draft.suggestionName ?? "the person who recommended it").")
                            .font(.caption).foregroundStyle(MoodieTheme.secondary)
                    }
                    if let error { InlineError(message: error) }
                }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
            }.disabled(!ready || busy).scrollDismissesKeyboard(.interactively).moodieScreen()
                .navigationTitle(draft.editingID == nil ? "Add a response" : "Edit response").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { writing = false; if dirty { closeOptions = true } else { dismiss() } }.disabled(busy)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button { Task { await save() } } label: { if busy { ProgressView() } else { Text("Save").bold() } }
                            .disabled(!ready || draft.validationMessage != nil || busy || loadingPhoto).accessibilityIdentifier("save-response")
                    }
                    ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { writing = false } }
                }
                .interactiveDismissDisabled(dirty || busy)
                .confirmationDialog("Keep this response for later?", isPresented: $closeOptions, titleVisibility: .visible) {
                    Button("Keep draft") { Task { await keepAndClose() } }
                    Button("Discard changes", role: .destructive) { Task { await discard() } }
                    Button("Keep writing", role: .cancel) { }
                }
                .alert("Continue your saved response?", isPresented: $draftChoice) {
                    Button("Continue draft") {
                        if let savedDraft { begin(savedDraft) }
                    }
                    Button("Discard draft and start new", role: .destructive) {
                        Task {
                            do {
                                if let id = state.user?.id { try await state.drafts.remove(userID: id) }
                                begin(draft)
                            } catch { self.error = error.localizedDescription }
                        }
                    }
                    Button("Cancel", role: .cancel) { dismiss() }
                } message: {
                    Text("You have an unfinished response\(savedDraft?.film.map { " for \($0.title)" } ?? ""). Keep writing it or start a new one.")
                }
                .sheet(isPresented: $choosingFilm) {
                    NavigationStack {
                        SearchView(selectFilm: { draft.film = $0; draft.suggestionId = nil; draft.suggestionName = nil; choosingFilm = false })
                            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { choosingFilm = false } } }
                    }
                }
                .task {
                    guard !ready, savedDraft == nil else { return }
                    if let response = request.response { draft = ResponseDraft(response: response) }
                    else if let film = request.film {
                        draft = ResponseDraft(film: film)
                        draft.suggestionId = request.suggestion?.id; draft.suggestionName = request.suggestion?.senderUsername
                    }
                    if let id = state.user?.id {
                        do {
                            if let saved = try await state.drafts.load(userID: id) {
                                if request.film == nil && request.response == nil { begin(saved); return }
                                if saved != draft && (!saved.note.isEmpty || saved.feelings.hasSelection || saved.expressionImage != nil) {
                                    savedDraft = saved; draftChoice = true; return
                                }
                            }
                        } catch { self.error = "Your saved draft could not be opened. You can start a new response." }
                    }
                    begin(draft)
                }
                .task(id: draft.film?.id) { await loadSuggestions() }
                .onChange(of: draft.suggestionId) { _, id in
                    draft.suggestionName = suggestions.first(where: { $0.id == id })?.senderUsername ?? draft.suggestionName
                }
                .task(id: draft) {
                    guard ready && !finished && dirty else { return }
                    do { try await Task.sleep(for: .milliseconds(600)); try await persistDraft() }
                    catch is CancellationError { }
                    catch { self.error = "Your draft couldn’t be saved on this device. Keep this screen open and try again." }
                }
                .onChange(of: scenePhase) { _, phase in if phase != .active && ready && !finished { Task { try? await persistDraft() } } }
                .onChange(of: photo) { _, item in Task { await loadPhoto(item) } }
            }
        }
    }
    private func begin(_ value: ResponseDraft) {
        draft = value
        if draft.editingID == nil && draft.clientRequestId == nil { draft.clientRequestId = UUID().uuidString }
        original = draft; ready = true; savedDraft = nil
    }
    private func loadSuggestions() async {
        guard let film = draft.film, draft.editingID == nil else { suggestions = []; return }
        do {
            let result: SuggestionsPage = try await state.api.get("suggestions", query: ["movieId": String(film.id), "limit": "100"])
            try Task.checkCancellation(); suggestions = result.suggestions; suggestionError = nil
        } catch { if !Task.isCancelled { suggestionError = "Recommendations couldn’t be loaded. You can still save your viewing and link it later." } }
    }
    private func persistDraft() async throws {
        guard let id = state.user?.id, !finished else { return }
        try await state.drafts.save(draft, userID: id)
    }
    private func keepAndClose() async {
        do { try await persistDraft(); finished = true; dismiss() } catch { self.error = error.localizedDescription }
    }
    private func discard() async {
        do { if let id = state.user?.id { try await state.drafts.remove(userID: id) }; finished = true; dismiss() }
        catch { self.error = error.localizedDescription }
    }
    private func save() async {
        guard !busy, draft.validationMessage == nil, let body = draft.input else { return }
        busy = true; error = nil; writing = false; defer { busy = false }
        do {
            let result: ResponseResult = try await state.api.send(draft.editingID.map { "diary/\($0)" } ?? "diary",
                method: draft.editingID == nil ? "POST" : "PATCH", body: body)
            finished = true
            if let id = state.user?.id { try? await state.drafts.remove(userID: id) }
            state.revision += 1
            if draft.editingID != nil { dismiss() } else { savedResponse = result.entry }
        } catch { self.error = error.localizedDescription; if error as? APIError == .signedOut { state.handle(error) } }
    }
    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        loadingPhoto = true; defer { loadingPhoto = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self), data.count <= 30 * 1024 * 1024,
                  let source = UIImage(data: data) else { throw PhotoError.invalid }
            let ratio = min(1, 1200 / max(source.size.width, source.size.height))
            let size = CGSize(width: source.size.width * ratio, height: source.size.height * ratio)
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in source.draw(in: CGRect(origin: .zero, size: size)) }
            guard let jpeg = image.jpegData(compressionQuality: 0.78), jpeg.count <= 2 * 1024 * 1024 else { throw PhotoError.tooLarge }
            draft.expressionImage = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        } catch { self.error = error.localizedDescription }
    }
    enum PhotoError: LocalizedError {
        case invalid, tooLarge
        var errorDescription: String? { "This photo couldn’t be prepared. Choose a smaller image and try again." }
    }
}
