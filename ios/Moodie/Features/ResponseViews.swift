import SwiftUI
import MoodieCore

struct ResponseCard: View {
    @Environment(AppState.self) private var state
    @Environment(\.dynamicTypeSize) private var typeSize
    let response: FilmResponse
    var expanded = false
    var showsAuthor = true
    var showsFilm = true
    @State private var liked = false
    @State private var count = 0
    @State private var busy = false
    @State private var reporting = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    if showsAuthor {
                        NavigationLink(value: MemberRoute(username: response.username)) {
                            HStack(spacing: 8) {
                                Avatar(name: response.username, size: 26)
                                Text(response.username).font(.subheadline.weight(.semibold))
                            }.frame(minHeight: 44, alignment: .leading).contentShape(Rectangle())
                        }.buttonStyle(.plain)
                    }
                    if showsFilm {
                        NavigationLink(value: response.film) {
                            Text(response.title).font(.system(expanded ? .title : .title2, design: .serif))
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }.buttonStyle(.plain)
                    }
                    Text((Day.date(from: String(response.watchedOn.prefix(10))) ?? Date()).formatted(.dateTime.month(.abbreviated).day().year())
                         + (response.visibility == "private" ? " · Private" : ""))
                        .font(.caption).foregroundStyle(MoodieTheme.secondary)
                }.frame(maxWidth: .infinity, alignment: .leading)
                if showsFilm {
                    NavigationLink(value: response.film) {
                        Poster(path: response.posterPath, width: expanded ? 76 : 60, title: response.title)
                    }.buttonStyle(.plain).accessibilityLabel("Open \(response.title)")
                }
            }
            if !response.note.isEmpty {
                if expanded {
                    Text(response.note).font(.body).lineSpacing(5).textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    NavigationLink(value: ResponseRoute(response: response)) {
                        Text(response.note).font(.body).lineSpacing(4).lineLimit(5)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }.buttonStyle(.plain).accessibilityIdentifier("read-response-\(response.id)")
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                FeelingTrace(feelings: response.feelings)
                ResponseDetails(enjoyment: response.enjoyment, highlights: response.highlights ?? [])
            }
            if let path = response.expressionImagePath { ResponsePhoto(path: path, alt: response.expressionImageAlt).frame(maxHeight: 200) }
            (typeSize.isAccessibilitySize ? AnyLayout(WrappingLayout(spacing: 16)) : AnyLayout(HStackLayout(spacing: 20))) {
                if response.visibility != "private" {
                    Button { Task { await toggleLike() } } label: {
                        Label(count > 0 ? "\(count)" : "Like", systemImage: liked ? "heart.fill" : "heart")
                            .foregroundStyle(liked ? MoodieTheme.accent : MoodieTheme.secondary)
                            .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                    }.disabled(busy).accessibilityLabel(liked ? "Unlike response" : "Like response")
                    if !expanded {
                        NavigationLink(value: ResponseRoute(response: response)) {
                            Label((response.commentCount ?? 0) > 0 ? "\(response.commentCount ?? 0)" : "Comment", systemImage: "bubble")
                                .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                        }.foregroundStyle(MoodieTheme.secondary).accessibilityLabel("Read response and comments")
                    }
                    if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                    if response.userId != state.user?.id { KeepRecommendationButton(sourceEntryId: response.id, compact: !expanded) }
                } else if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                if !expanded {
                    Menu {
                        if response.userId == state.user?.id {
                            Button("Edit response", systemImage: "pencil") { state.composer = ComposerRequest(response: response) }
                        } else { Button("Report response", systemImage: "flag") { reporting = true } }
                    } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }
                        .foregroundStyle(MoodieTheme.secondary).accessibilityLabel("Response options")
                }
            }.font(.subheadline).buttonStyle(.borderless)
            if expanded && response.userId == state.user?.id {
                RecommendFilmButton(title: "Recommend this film", film: response.film, sourceEntryId: response.visibility == "public" ? response.id : nil)
            }
        }.padding(.vertical, 4).onAppear { liked = response.liked ?? false; count = response.likeCount ?? 0 }
            .onChange(of: response) { _, new in liked = new.liked ?? false; count = new.likeCount ?? 0 }
            .sheet(isPresented: $reporting) { ReportView(target: .response(response.id), personID: response.userId) }
    }
    private func toggleLike() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            try await state.api.mutate("discovery/entries/\(response.id)/like", method: liked ? "DELETE" : "POST", body: EmptyBody())
            count = max(0, count + (liked ? -1 : 1)); liked.toggle()
        } catch { state.handle(error) }
    }
}

struct ResponsePhoto: View {
    let path: String
    let alt: String?
    var body: some View {
        Group {
            if path.hasPrefix("data:image/"), let encoded = path.split(separator: ",", maxSplits: 1).last,
               let bytes = Data(base64Encoded: String(encoded)), let image = UIImage(data: bytes) {
                Image(uiImage: image).resizable().scaledToFit()
            } else if path.hasPrefix("/"), !path.hasPrefix("//"),
                      let raw = Bundle.main.object(forInfoDictionaryKey: "MoodieAPIURL") as? String,
                      let base = URL(string: raw),
                      let url = URL(string: path, relativeTo: base.deletingLastPathComponent()),
                      url.host == base.host, url.scheme == "https" || url.host == "127.0.0.1" {
                AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { Color.clear }
            }
        }.clipShape(RoundedRectangle(cornerRadius: 8)).accessibilityLabel(alt ?? "Optional expression photo")
    }
}

struct ResponseDetailView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let response: FilmResponse
    @State private var current: FilmResponse?
    @State private var comments: [Comment] = []
    @State private var offset: Int?
    @State private var commentTotal: Int?
    @State private var commentsLoading = false
    @State private var commentRequest = UUID()
    @State private var receipt: String?
    @State private var text = ""
    @State private var error: String?
    @State private var commentsError: String?
    @State private var busy = false
    @State private var report: Comment?
    @State private var deleting = false
    @State private var reportingResponse = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let current {
                    ResponseCard(response: current, expanded: true)
                    if current.userId == state.user?.id {
                        SuggestionsForFilm(movieId: current.movieId, entryId: current.id)
                        NavigationLink(value: FilmHistoryRoute(film: current.film)) { Label("Your viewings of this film", systemImage: "clock.arrow.circlepath") }
                            .accessibilityIdentifier("viewing-history")
                    }
                }
                else if error == nil { ProgressView().frame(maxWidth: .infinity) }
                if let error { InlineError(message: error) { Task { await load() } } }
                if current?.visibility == "public" {
                Divider()
                Text(commentTotal.map { "Comments · \($0)" } ?? "Comments").font(.headline)
                if let commentsError { InlineError(message: commentsError) { Task { await loadComments() } } }
                if let receipt { Text(receipt).font(.caption).accessibilityAddTraits(.updatesFrequently) }
                if commentsLoading { ProgressView().frame(maxWidth: .infinity) }
                if comments.isEmpty && !commentsLoading && commentTotal != nil && error == nil && commentsError == nil { Text("No comments yet.").font(.subheadline).foregroundStyle(MoodieTheme.secondary) }
                ForEach(comments) { comment in
                    HStack(alignment: .top, spacing: 12) {
                        Avatar(name: comment.username)
                        VStack(alignment: .leading, spacing: 6) {
                            NavigationLink(value: MemberRoute(username: comment.username)) { Text(comment.username).font(.subheadline.weight(.semibold)) }.buttonStyle(.plain)
                            Text(comment.body).textSelection(.enabled)
                        }
                        Spacer(minLength: 0)
                        Menu {
                            if comment.own { Button("Delete comment", role: .destructive) { Task { await remove(comment) } } }
                            else { Button("Report comment", systemImage: "flag") { report = comment } }
                        } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.accessibilityLabel("Comment options")
                    }
                    Divider()
                }
                if offset != nil { Button("More comments") { Task { await loadComments(more: true) } }.disabled(commentsLoading) }
                }
            }.padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle("Response").navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .task(id: state.revision) { await load() }.refreshable { await load() }
            .safeAreaInset(edge: .bottom) {
                if current?.visibility == "public" {
                    HStack(alignment: .bottom, spacing: 12) {
                        TextField("Add a comment", text: $text, axis: .vertical).lineLimit(1...5)
                            .padding(.horizontal, 14).padding(.vertical, 11)
                            .background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 20))
                            .accessibilityIdentifier("comment-body")
                        Button { Task { await send() } } label: {
                            Image(systemName: "arrow.up.circle.fill").font(.system(size: 32)).frame(width: 44, height: 44)
                        }.buttonStyle(.plain).disabled(busy || commentsLoading || commentTotal == nil || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || text.count > 1000)
                            .accessibilityLabel("Send comment")
                    }.padding().background(.bar)
                }
            }
            .sheet(item: $report) { ReportView(target: .comment($0.id), personID: $0.userId) }
            .sheet(isPresented: $reportingResponse) {
                if let current { ReportView(target: .response(current.id), personID: current.userId) }
            }
            .toolbar {
                if let current, current.userId == state.user?.id {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("Edit response", systemImage: "pencil") { state.composer = ComposerRequest(response: current) }
                            Button("Add another viewing", systemImage: "plus") { state.composer = ComposerRequest(film: current.film) }
                            Button("Delete response", systemImage: "trash", role: .destructive) { deleting = true }
                        } label: { Image(systemName: "ellipsis") }.accessibilityLabel("Your response actions")
                    }
                } else if current != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu { Button("Report response", systemImage: "flag") { reportingResponse = true } }
                        label: { Image(systemName: "ellipsis") }.accessibilityLabel("Response options")
                    }
                }
            }
            .alert("Delete this response?", isPresented: $deleting) {
                Button("Cancel", role: .cancel) { }
                Button("Delete response", role: .destructive) { Task {
                    do { try await state.api.mutate("diary/\(response.id)", method: "DELETE", body: EmptyBody()); state.revision += 1; dismiss() }
                    catch { state.handle(error) }
                } }
            } message: { Text("Your note, feelings, photo, and comments on this response will be permanently removed.") }
    }
    private func load() async {
        commentRequest = UUID(); commentsLoading = false
        error = nil; commentsError = nil
        do {
            let detail: ResponseResult = try await state.api.get("discovery/entries/\(response.id)")
            try Task.checkCancellation()
            current = detail.entry
            if detail.entry.visibility == "public" { await loadComments() }
            else { comments = []; offset = nil; commentTotal = nil; commentRequest = UUID() }
        } catch {
            guard !Task.isCancelled else { return }
            if removesAccess(error) { current = nil; comments = [] }
            self.error = error.localizedDescription
        }
    }
    private func loadComments(more: Bool = false) async {
        let token = UUID(); commentRequest = token
        commentsLoading = true; commentsError = nil
        defer { if commentRequest == token { commentsLoading = false } }
        do {
            let result: CommentsResult = try await state.api.get("discovery/entries/\(response.id)/comments", query: ["limit": "30", "offset": String(more ? offset ?? 0 : 0)])
            try Task.checkCancellation(); guard commentRequest == token else { return }
            if more { let ids = Set(comments.map(\.id)); comments += result.comments.filter { !ids.contains($0.id) } } else { comments = result.comments }
            offset = result.nextOffset; commentTotal = result.total ?? comments.count
        } catch {
            guard !Task.isCancelled, commentRequest == token else { return }
            if removesAccess(error) { current = nil; comments = []; offset = nil; commentTotal = nil; self.error = error.localizedDescription }
            else { commentsError = "Comments couldn’t be loaded. The response is still here." }
        }
    }
    private func removesAccess(_ error: Error) -> Bool {
        guard let error = error as? APIError else { return false }
        switch error {
        case .signedOut: return true
        case .server(let status, _): return [401, 403, 404, 410].contains(status)
        default: return false
        }
    }
    private func send() async {
        busy = true; defer { busy = false }
        do { try await state.api.mutate("discovery/entries/\(response.id)/comments", body: ["body": text]); text = ""; receipt = "Comment posted."; await load() }
        catch { state.handle(error) }
    }
    private func remove(_ comment: Comment) async {
        do { try await state.api.mutate("discovery/comments/\(comment.id)", method: "DELETE", body: EmptyBody()); comments.removeAll { $0.id == comment.id }; receipt = "Comment removed."; await load() }
        catch { state.handle(error) }
    }
}
