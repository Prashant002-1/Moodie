import Foundation

public enum Enjoyment: String, Codable, CaseIterable, Identifiable, Sendable {
    case loved, liked, mixed, notForMe = "not_for_me"
    public var id: String { rawValue }
    public var title: String {
        switch self { case .loved: "Loved it"; case .liked: "Liked it"; case .mixed: "Mixed feelings"; case .notForMe: "Not for me" }
    }
}
public enum ResponseHighlight: String, Codable, CaseIterable, Identifiable, Sendable {
    case story, characters, performances, dialogue, images, music, ending
    public var id: String { rawValue }
    public var title: String { rawValue.capitalized }
}

public struct FilmSuggestion: Decodable, Identifiable, Sendable {
    public let id: Int
    public let origin: String
    public let reason: String
    public let senderId: Int
    public let senderUsername: String
    public let recipientId: Int
    public let recipientUsername: String
    public let movieId: Int
    public let title: String
    public let posterPath: String?
    public let releaseDate: String?
    public let createdAt: String
    public let updatedAt: String
    public let archived: Bool
    public let conversationOpen: Bool?
    public let status: String
    public let linkedEntryId: Int?
    public let sourceEntryId: Int?
    public let sourceNote: String?
    public let sourceFeelings: Feelings?
    public let reply: SuggestionReply?
    public let messageCount: Int
    public var film: Film { Film(id: movieId, title: title, releaseDate: releaseDate, posterPath: posterPath) }
    public var canConverse: Bool { conversationOpen ?? (origin == "sent" || reply != nil) }
    public var context: String { origin == "sent" ? reason : (sourceNote ?? "Their response is no longer shared.") }
    public var statusTitle: String {
        switch status { case "replied": "Replied"; case "watched": "Watched · reply when you’re ready"; case "saved": "Saved for later"; case "sent": "Sent"; case "shared": "Conversation"; default: "Recommended to you" }
    }
}
public struct SuggestionReply: Decodable, Sendable {
    public let enjoyment: Enjoyment
    public let highlights: [ResponseHighlight]
    public let note: String
    public let feelings: Feelings?
    public let containsSpoilers: Bool
    public let createdAt: String
    public let updatedAt: String
}
public struct SuggestionMessage: Decodable, Identifiable, Sendable {
    public let id: Int
    public let userId: Int
    public let username: String
    public let body: String
    public let containsSpoilers: Bool
    public let createdAt: String
}
public struct SuggestionsPage: Decodable, Sendable { public let suggestions: [FilmSuggestion]; public let nextOffset: Int? }
public struct SuggestionResult: Decodable, Sendable { public let suggestion: FilmSuggestion }
public struct SuggestionMessagesPage: Decodable, Sendable { public let messages: [SuggestionMessage]; public let nextOffset: Int? }

public struct SuggestionInput: Encodable, Sendable {
    public let origin: String
    public var movieId: Int?
    public var recipientId: Int?
    public var reason: String?
    public var sourceEntryId: Int?
    public init(movieId: Int, recipientId: Int, reason: String, sourceEntryId: Int? = nil) {
        origin = "sent"; self.movieId = movieId; self.recipientId = recipientId; self.reason = reason; self.sourceEntryId = sourceEntryId
    }
    public init(sourceEntryId: Int) { origin = "discovered"; self.sourceEntryId = sourceEntryId }
}
public struct SuggestionAction: Encodable, Sendable {
    public let action: String
    public let entryId: Int?
    public init(_ action: String, entryId: Int? = nil) { self.action = action; self.entryId = entryId }
}
public struct SuggestionReplyInput: Encodable, Sendable {
    public let entryId: Int
    public let enjoyment: Enjoyment
    public let highlights: [ResponseHighlight]
    public let note: String
    public let shareFeelings: Bool
    public let containsSpoilers: Bool
    public init(entryId: Int, enjoyment: Enjoyment, highlights: [ResponseHighlight], note: String, shareFeelings: Bool, containsSpoilers: Bool) {
        self.entryId = entryId; self.enjoyment = enjoyment; self.highlights = highlights; self.note = note
        self.shareFeelings = shareFeelings; self.containsSpoilers = containsSpoilers
    }
}
public struct SuggestionMessageInput: Encodable, Sendable {
    public let body: String
    public let clientRequestId: String
    public let containsSpoilers: Bool
    public init(body: String, clientRequestId: String, containsSpoilers: Bool) {
        self.body = body; self.clientRequestId = clientRequestId; self.containsSpoilers = containsSpoilers
    }
}
