import Foundation
import Testing
@testable import MoodieCore

/// Run through scripts/verify-platform-continuity.mjs. Uses a disposable local API,
/// the real native transport and Codable models, and no user Keychain or database.
@Suite(.enabled(if: ProcessInfo.processInfo.environment["MOODIE_PLATFORM_FIXTURE"] != nil))
struct LivePlatformTests {
    struct Fixture: Decodable { let baseURL: String; let username: String; let password: String; let suggestionId: Int; let sourceId: Int; let output: String }
    @Test func webRecommendationContinuesInNativeAndPersistsAcrossClientRecreation() async throws {
        let path = try #require(ProcessInfo.processInfo.environment["MOODIE_PLATFORM_FIXTURE"])
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        let vault = TestVault()
        let api = try APIClient(baseURL: URL(string: fixture.baseURL)!, credentials: vault, allowLocalHTTP: true)
        let auth: AuthResult = try await api.send("auth/login", body: SignInInput(identifier: fixture.username, password: fixture.password))
        let item: SuggestionResult = try await api.get("suggestions/\(fixture.suggestionId)")
        #expect(item.suggestion.recipientId == auth.user.id)
        #expect(item.suggestion.reason == "For your quiet evening")
        #expect(item.suggestion.sourceEntryId == fixture.sourceId)
        let profile: ProfileResult = try await api.get("discovery/people/web_sender", query: ["limit": "1", "includeConnections": "false"])
        #expect(profile.person.entries == 1 && profile.person.films == 1)
        #expect(profile.person.following == true)
        let film: ResponsesResult = try await api.get("discovery/films/101", query: ["limit": "1", "scope": "following"])
        #expect(film.summary?.total == 1 && film.film?.id == 101)
        let saved: SuggestionResult = try await api.send("suggestions/\(fixture.suggestionId)", method: "PATCH", body: SuggestionAction("save"))
        #expect(saved.suggestion.status == "saved")
        let status: LibraryStatusResult = try await api.get("library/status", query: ["movieIds": "101"])
        #expect(status.films.first?.saved == true)
        var draft = ResponseDraft(film: Film(id: 101, title: "Quiet Film"))
        draft.note = "Private native diary words"
        draft.feelings[.sad] = 0.7; draft.feelings[.happy] = 0.3
        draft.enjoyment = .liked; draft.highlights = [.music]
        draft.suggestionId = fixture.suggestionId
        let input = try #require(draft.input)
        let created: ResponseResult = try await api.send("diary", body: input)
        let retried: ResponseResult = try await api.send("diary", body: input)
        #expect(created.entry.id == retried.entry.id)
        #expect(created.entry.visibility == "private" && created.entry.note == draft.note)
        let reply: SuggestionResult = try await api.send("suggestions/\(fixture.suggestionId)/reply", method: "PUT", body: SuggestionReplyInput(entryId: created.entry.id, enjoyment: .liked, highlights: [.music], note: "The music stayed with me", shareFeelings: false, containsSpoilers: false))
        #expect(reply.suggestion.reply?.feelings == nil)
        let message = SuggestionMessageInput(body: "Thank you for thinking of me", clientRequestId: UUID().uuidString, containsSpoilers: false)
        try await api.mutate("suggestions/\(fixture.suggestionId)/messages", body: message)
        try await api.mutate("suggestions/\(fixture.suggestionId)/messages", body: message)
        try await api.mutate("discovery/entries/\(fixture.sourceId)/comments", body: ["body": "A comment from native"])
        let comments: CommentsResult = try await api.get("discovery/entries/\(fixture.sourceId)/comments", query: ["limit": "1"])
        #expect(comments.total == 1 && comments.comments.first?.own == true)
        // A fresh APIClient shares only the persisted session credential, not screen state.
        let reopened = try APIClient(baseURL: URL(string: fixture.baseURL)!, credentials: vault, allowLocalHTTP: true)
        let diary: DiaryPage = try await reopened.get("diary", query: ["movieId": "101", "limit": "1"])
        #expect(diary.entries.first?.id == created.entry.id && diary.nextOffset == nil)
        let messages: SuggestionMessagesPage = try await reopened.get("suggestions/\(fixture.suggestionId)/messages")
        #expect(messages.messages.count == 1)
        let output = try JSONSerialization.data(withJSONObject: ["entryId": created.entry.id])
        try output.write(to: URL(fileURLWithPath: fixture.output))
    }
}
