import Foundation
import Testing
@testable import MoodieCore

@Suite struct DomainTests {
    @Test func feelingIntensityIsPreservedAndBounded() {
        var feelings = Feelings()
        #expect(!feelings.hasSelection)
        feelings[.happy] = 0.8; feelings[.sad] = 0.7
        #expect(feelings.happy == 0.8 && feelings.sad == 0.7)
        #expect(feelings.strongest == [.happy, .sad])
        feelings[.angry] = .infinity; feelings[.fearful] = -2; feelings[.surprised] = 12
        #expect(feelings.angry == 0 && feelings.fearful == 0 && feelings.surprised == 1)
    }
    @Test func composerRequiresFilmFeelingAndValidDate() {
        var draft = ResponseDraft()
        #expect(draft.visibility == "private")
        #expect(draft.validationMessage == "Choose a film first.")
        draft.film = Film(id: 1, title: "A film")
        #expect(draft.validationMessage == "Choose at least one feeling.")
        draft.feelings[.neutral] = 0.3
        #expect(draft.validationMessage == nil)
        draft.watchedOn = "2026-02-30"
        #expect(draft.validationMessage != nil)
        draft.watchedOn = "2999-01-01"
        #expect(draft.validationMessage != nil)
    }
    @Test func clearingPhotoEncodesExplicitNullAndCamelCaseInput() throws {
        var draft = ResponseDraft(film: Film(id: 2, title: "Another film"))
        draft.feelings[.happy] = 0.6
        let data = try JSONEncoder().encode(try #require(draft.input))
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["expressionImage"] is NSNull)
        #expect(json["movieId"] as? Int == 2)
        #expect(json["movie_id"] == nil)
    }
    @Test func serverSnakeCaseAndNullsDecode() throws {
        let json = #"{"entries":[{"id":1,"user_id":2,"movie_id":3,"username":"sam","title":"Film","note":"Stayed with me","watched_on":"2026-08-01T00:00:00.000Z","created_at":"2026-08-01T12:00:00Z","poster_path":null,"neutral":0.2,"happy":0.7,"sad":0,"angry":0,"fearful":0,"disgusted":0,"surprised":0.1,"like_count":0,"liked":false}],"nextCursor":"abc_123"}"#
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let page = try decoder.decode(FeedPage.self, from: Data(json.utf8))
        #expect(page.entries[0].film.id == 3)
        #expect(page.entries[0].feelings.happy == 0.7)
        #expect(page.nextCursor == "abc_123")
        #expect(ResponseDraft(response: page.entries[0]).watchedOn == "2026-08-01")
    }
    @Test func activityUsesServerIdentityAndDecodesLegacyEvents() throws {
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let json = #"{"activity":[{"event_id":"suggestion_message:1","kind":"suggestion_message","created_at":"2026-01-01","actor_id":2,"username":"friend","suggestion_id":9},{"event_id":"suggestion_message:2","kind":"suggestion_message","created_at":"2026-01-01","actor_id":2,"username":"friend","suggestion_id":9}],"nextOffset":null}"#
        let page = try decoder.decode(ActivityPage.self, from: Data(json.utf8))
        #expect(Set(page.activity.map(\.id)).count == 2)
        #expect(page.activity[0].id == "suggestion_message:1")
        #expect(page.activity[0].commentBody == nil)
        let legacy = #"{"kind":"follow","created_at":"2026-01-01","actor_id":2,"username":"friend"}"#
        #expect(try decoder.decode(Activity.self, from: Data(legacy.utf8)).id == "follow-2-0-0-2026-01-01")
    }
    @Test func artworkCannotPointToAnArbitraryServer() {
        #expect(Artwork.url(path: "/poster.jpg")?.host == "image.tmdb.org")
        for path in ["https://evil.test/image", "//evil.test/image", "/../image", "/image?secret=x"] {
            #expect(Artwork.url(path: path) == nil)
        }
    }
    @Test func draftsRemainAccountScopedAndCanBeRemoved() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = DraftStore(directory: directory)
        var draft = ResponseDraft(film: Film(id: 9, title: "A private film")); draft.note = "Private words"
        try await store.save(draft, userID: 1)
        #expect(try await store.load(userID: 1) == draft)
        #expect(try await store.load(userID: 2) == nil)
        try await store.remove(userID: 1)
        #expect(try await store.load(userID: 1) == nil)
    }
    @Test func insecureRemoteConfigurationIsRejected() throws {
        let vault = TestVault()
        #expect(throws: APIError.insecureURL) { try APIClient(baseURL: URL(string: "http://remote.example/api")!, credentials: vault, allowLocalHTTP: true) }
        #expect(throws: APIError.insecureURL) { try APIClient(baseURL: URL(string: "http://127.0.0.1:3001/api")!, credentials: vault) }
        _ = try APIClient(baseURL: URL(string: "http://127.0.0.1:3001/api")!, credentials: vault, allowLocalHTTP: true)
    }
    @Test func oldDraftsDecodeAndNewDraftsRetainAttributionAndRetryIdentity() throws {
        let old = #"{"note":"old draft","watchedOn":"2026-01-01","visibility":"private","feelings":{"neutral":0,"happy":0.5,"sad":0,"angry":0,"fearful":0,"disgusted":0,"surprised":0}}"#
        let legacy = try JSONDecoder().decode(ResponseDraft.self, from: Data(old.utf8))
        #expect(legacy.clientRequestId == nil && legacy.suggestionId == nil)
        var draft = ResponseDraft(film: Film(id: 101, title: "A Film"))
        draft.suggestionId = 8; draft.suggestionName = "ananya"
        draft.enjoyment = .mixed; draft.highlights = [.music]; draft.feelings[.sad] = 0.85
        let restored = try JSONDecoder().decode(ResponseDraft.self, from: JSONEncoder().encode(draft))
        #expect(restored == draft && restored.clientRequestId != nil)
        let body = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(restored.input)) as? [String: Any])
        #expect(body["suggestionId"] as? Int == 8)
        #expect(body["clientRequestId"] as? String == draft.clientRequestId)
        #expect(body["enjoyment"] as? String == "mixed")
        #expect(body["highlights"] as? [String] == ["music"])
    }
    @Test func recommendationAndReplyDecodeWithoutExposingDiaryFields() throws {
        let json = #"{"suggestion":{"id":9,"origin":"sent","reason":"For the quiet ending","sender_id":2,"sender_username":"ananya","recipient_id":1,"recipient_username":"sam","movie_id":101,"title":"A Film","poster_path":null,"release_date":null,"created_at":"2026-01-01","updated_at":"2026-01-02","archived":false,"status":"replied","linked_entry_id":null,"source_entry_id":null,"source_note":null,"source_feelings":null,"message_count":0,"reply":{"enjoyment":"not_for_me","highlights":["music"],"note":"Thanks for thinking of me","feelings":null,"contains_spoilers":false,"created_at":"2026-01-02","updated_at":"2026-01-02"}}}"#
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let item = try decoder.decode(SuggestionResult.self, from: Data(json.utf8)).suggestion
        #expect(item.reply?.enjoyment == .notForMe)
        #expect(item.linkedEntryId == nil && item.sourceEntryId == nil)
        #expect(item.film.id == 101 && item.statusTitle == "Replied")
        let input = SuggestionReplyInput(entryId: 3, enjoyment: .mixed, highlights: [.music], note: "My separate reply", shareFeelings: false, containsSpoilers: true)
        let body = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any])
        #expect(body["shareFeelings"] as? Bool == false)
        #expect(body["note"] as? String == "My separate reply")
        #expect(body["emotions"] == nil && body["expressionImage"] == nil)
    }
}

final class TestVault: CredentialStore, @unchecked Sendable {
    private let lock = NSLock()
    private var value: SessionCredential?
    func read() throws -> SessionCredential? { lock.withLock { value } }
    func write(_ credential: SessionCredential?) throws { lock.withLock { value = credential } }
}

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) throws -> (Int, [String: String], Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (code, headers, body) = try Self.handler!(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body); client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@Suite(.serialized) struct TransportTests {
    private func client(_ vault: TestVault) throws -> APIClient {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [StubProtocol.self]
        return try APIClient(baseURL: URL(string: "https://moodie.example/api")!, credentials: vault, session: URLSession(configuration: config))
    }
    @Test func loginPersistsCookieAndSendsItWithMutations() async throws {
        let vault = TestVault(), token = String(repeating: "a", count: 64)
        let api = try client(vault)
        StubProtocol.handler = { request in
            #expect(request.url?.path == "/api/auth/login")
            #expect(request.value(forHTTPHeaderField: "X-Moodie-Request") == "1")
            return (200, ["Set-Cookie": "moodie_session=\(token); Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax"], Data(#"{"user":{"id":1,"username":"sam","email":"sam@example.test"}}"#.utf8))
        }
        let _: AuthResult = try await api.send("auth/login", body: SignInInput(identifier: "sam", password: "test-password"))
        #expect(try vault.read()?.token == token)
        StubProtocol.handler = { request in
            #expect(request.value(forHTTPHeaderField: "Cookie") == "moodie_session=\(token)")
            #expect(request.httpMethod == "DELETE")
            return (204, [:], Data())
        }
        try await api.mutate("library/saved/1", method: "DELETE", body: EmptyBody())
    }
    @Test func sessionExpiryClearsCredentialAndPreservesServerValidationErrors() async throws {
        let vault = TestVault(); try vault.write(.init(token: String(repeating: "b", count: 64), expiresAt: Date().addingTimeInterval(100)))
        let api = try client(vault)
        StubProtocol.handler = { _ in (401, [:], Data(#"{"error":"expired"}"#.utf8)) }
        await #expect(throws: APIError.signedOut) { let _: AuthResult = try await api.get("auth/me") }
        #expect(try vault.read() == nil)
        StubProtocol.handler = { _ in (400, [:], Data(#"{"error":"Choose at least one feeling."}"#.utf8)) }
        await #expect(throws: APIError.server(400, "Choose at least one feeling.")) {
            try await api.mutate("diary", body: EmptyBody())
        }
    }
    @Test func malformedResponseDoesNotBecomeAnEmptyFeed() async throws {
        let api = try client(TestVault())
        StubProtocol.handler = { _ in (200, [:], Data(#"{"unexpected":true}"#.utf8)) }
        await #expect(throws: APIError.invalidResponse) { let _: FeedPage = try await api.get("discovery/feed") }
    }
    @Test func queryIsEncodedAndPathCannotEscapeAPIOrigin() async throws {
        let api = try client(TestVault())
        StubProtocol.handler = { request in
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems
            #expect(query?.first(where: { $0.name == "q" })?.value == "A & B/夜")
            return (200, [:], Data(#"{"results":[]}"#.utf8))
        }
        let _: FilmPage = try await api.get("catalog/search", query: ["q": "A & B/夜"])
        await #expect(throws: APIError.invalidConfiguration) { let _: FilmPage = try await api.get("../auth/me") }
    }
}
