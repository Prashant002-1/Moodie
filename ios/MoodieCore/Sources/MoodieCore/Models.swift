import Foundation

public enum Feeling: String, CaseIterable, Codable, Identifiable, Sendable {
    case neutral, happy, sad, angry, fearful, disgusted, surprised
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .neutral: "Stillness"
        case .happy: "Joy"
        case .sad: "Melancholy"
        case .angry: "Friction"
        case .fearful: "Tension"
        case .disgusted: "Unease"
        case .surprised: "Wonder"
        }
    }
}

public struct Feelings: Codable, Hashable, Sendable {
    public var neutral: Double = 0
    public var happy: Double = 0
    public var sad: Double = 0
    public var angry: Double = 0
    public var fearful: Double = 0
    public var disgusted: Double = 0
    public var surprised: Double = 0
    public init() {}
    public subscript(feeling: Feeling) -> Double {
        get {
            switch feeling {
            case .neutral: neutral; case .happy: happy; case .sad: sad
            case .angry: angry; case .fearful: fearful; case .disgusted: disgusted; case .surprised: surprised
            }
        }
        set {
            let value = newValue.isFinite ? min(1, max(0, newValue)) : 0
            switch feeling {
            case .neutral: neutral = value; case .happy: happy = value; case .sad: sad = value
            case .angry: angry = value; case .fearful: fearful = value
            case .disgusted: disgusted = value; case .surprised: surprised = value
            }
        }
    }
    public var hasSelection: Bool { Feeling.allCases.contains { self[$0] >= 0.001 } }
    public var strongest: [Feeling] {
        Feeling.allCases.filter { self[$0] >= 0.001 }.sorted {
            self[$0] == self[$1] ? $0.rawValue < $1.rawValue : self[$0] > self[$1]
        }
    }
}

public struct Member: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let username: String
    public let bio: String?
    public let email: String?
    public let entries: Int?
    public let films: Int?
    public let followers: Int?
    public let followingCount: Int?
    public var following: Bool?
    public let followsYou: Bool?
    public let sharedFilmTitle: String?
    public let latestMovieId: Int?
    public let latestTitle: String?
    public let latestPosterPath: String?
    public let latestNote: String?
    /// "on", "off", or nil until the person chooses during onboarding. Only present on the signed-in account.
    public let aiMode: String?
}

public struct RecommendationSource: Codable, Hashable, Sendable, Identifiable {
    public let id: Int
    public let username: String
    public let sharedFilmTitle: String
    public let sharedFeelings: [Feeling]
    public let responseFeelings: [Feeling]
    public let viewerSharedNote: String
    public let personSharedNote: String
    public let sharedMovieId: Int?
    public let responseId: Int
    public let responseNote: String
    public let sharedResponseId: Int?
    public let viewerSharedFeelings: Feelings?
    public let personSharedFeelings: Feelings?
}

public struct Film: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let title: String
    public let overview: String?
    public let releaseDate: String?
    public let posterPath: String?
    public let backdropPath: String?
    public let runtime: Int?
    public let genres: [Genre]?
    public let recommendedBy: [RecommendationSource]?
    public var year: String { String((releaseDate ?? "").prefix(4)) }
    public init(id: Int, title: String, overview: String? = nil, releaseDate: String? = nil,
                posterPath: String? = nil, backdropPath: String? = nil) {
        self.id = id; self.title = title; self.overview = overview; self.releaseDate = releaseDate
        self.posterPath = posterPath; self.backdropPath = backdropPath
        runtime = nil; genres = nil; recommendedBy = nil
    }
}
public struct Genre: Codable, Hashable, Sendable { public let id: Int; public let name: String }

public struct FilmResponse: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let userId: Int
    public let movieId: Int
    public let username: String
    public let title: String
    public let note: String
    public let watchedOn: String
    public let createdAt: String
    public let visibility: String?
    public let posterPath: String?
    public let backdropPath: String?
    public let releaseDate: String?
    public let overview: String?
    public let expressionImagePath: String?
    public let expressionImageAlt: String?
    public var likeCount: Int?
    public var liked: Bool?
    public let commentCount: Int?
    public let viewingCount: Int?
    public let enjoyment: Enjoyment?
    public let highlights: [ResponseHighlight]?
    public let neutral: Double
    public let happy: Double
    public let sad: Double
    public let angry: Double
    public let fearful: Double
    public let disgusted: Double
    public let surprised: Double
    public var feelings: Feelings {
        var value = Feelings()
        value.neutral = neutral; value.happy = happy; value.sad = sad; value.angry = angry
        value.fearful = fearful; value.disgusted = disgusted; value.surprised = surprised
        return value
    }
    public var film: Film {
        Film(id: movieId, title: title, overview: overview, releaseDate: releaseDate,
             posterPath: posterPath, backdropPath: backdropPath)
    }
}

public struct SavedFilm: Codable, Identifiable, Sendable {
    public let id: Int
    public let movieId: Int
    public let title: String
    public let overview: String?
    public let releaseDate: String?
    public let posterPath: String?
    public let backdropPath: String?
    public var film: Film { Film(id: movieId, title: title, overview: overview, releaseDate: releaseDate,
                                 posterPath: posterPath, backdropPath: backdropPath) }
}

public struct Comment: Codable, Identifiable, Sendable {
    public let id: Int
    public let entryId: Int
    public let userId: Int
    public let username: String
    public let body: String
    public let createdAt: String
    public let own: Bool
}

public struct Activity: Decodable, Identifiable, Sendable {
    public let eventId: String?
    public let kind: String
    public let createdAt: String
    public let actorId: Int
    public let username: String
    public let entryId: Int?
    public let movieId: Int?
    public let title: String?
    public let posterPath: String?
    public let commentBody: String?
    public let note: String?
    public let suggestionId: Int?
    public var id: String { eventId ?? "\(kind)-\(actorId)-\(entryId ?? 0)-\(suggestionId ?? 0)-\(createdAt)" }
}

public struct AuthResult: Decodable, Sendable { public let user: Member; public let recoveryCode: String? }
public struct FeedPage: Decodable, Sendable { public let entries: [FilmResponse]; public let nextCursor: String? }
public struct DiaryPage: Decodable, Sendable { public let entries: [FilmResponse]; public let nextOffset: Int? }
public struct FilmPage: Decodable, Sendable { public let results: [Film]; public let page: Int?; public let totalPages: Int? }
public struct PeopleResult: Decodable, Sendable { public let people: [Member]; public let nextOffset: Int? }
public struct ProfileResult: Decodable, Sendable {
    public let person: Member
    public let entries: [FilmResponse]
    public let nextOffset: Int?
    public let followers: [Member]?
    public let following: [Member]?
}
public struct DiarySummary: Decodable, Sendable {
    public let entries: Int
    public let publicEntries: Int
    public let saved: Int
    public let recent: RecentDiarySummary?
}
public struct RecentDiarySummary: Decodable, Sendable {
    public let entries: Int
    public let feelings: Feelings
}
public struct ResponsesResult: Decodable, Sendable { public let entries: [FilmResponse]; public let nextOffset: Int?; public let summary: FilmResponseSummary?; public let film: Film? }
public struct FilmResponseSummary: Decodable, Sendable { public let total: Int; public let neutral: Double?; public let happy: Double?; public let sad: Double?; public let angry: Double?; public let fearful: Double?; public let disgusted: Double?; public let surprised: Double? }
public struct ResponseResult: Decodable, Sendable { public let entry: FilmResponse }
public struct SavedResult: Decodable, Sendable { public let films: [SavedFilm]; public let nextOffset: Int? }
public struct CommentsResult: Decodable, Sendable { public let comments: [Comment]; public let nextOffset: Int?; public let total: Int? }
public struct ActivityPage: Decodable, Sendable { public let activity: [Activity]; public let nextOffset: Int? }
public struct Recommendations: Decodable, Sendable { public let forYou: [Film]; public let adjacent: [Film]; public let community: [Film] }
public struct BlockedResult: Decodable, Sendable { public let people: [Member]; public let nextOffset: Int? }
public struct CommunityResult: Decodable, Sendable { public let films: [CommunityFilm] }
public struct CommunityFilm: Decodable, Identifiable, Sendable {
    public let movieId: Int
    public let title: String
    public let releaseDate: String?
    public let posterPath: String?
    public let latestUsername: String?
    public let latestNote: String?
    public var id: Int { movieId }
    public var film: Film { Film(id: movieId, title: title, releaseDate: releaseDate, posterPath: posterPath) }
}

public struct ResponseDraft: Codable, Equatable, Sendable {
    public var film: Film?
    public var note = ""
    public var watchedOn: String
    public var visibility = "private"
    public var feelings = Feelings()
    public var expressionImage: String?
    public var editingID: Int?
    public var enjoyment: Enjoyment?
    public var highlights: [ResponseHighlight]?
    public var suggestionId: Int?
    public var suggestionName: String?
    public var clientRequestId: String?
    public init(film: Film? = nil, now: Date = Date()) {
        self.film = film; watchedOn = Day.string(from: now); clientRequestId = UUID().uuidString
    }
    public init(response: FilmResponse) {
        film = response.film; note = response.note; watchedOn = String(response.watchedOn.prefix(10))
        visibility = response.visibility ?? "private"; feelings = response.feelings
        expressionImage = response.expressionImagePath; editingID = response.id
        enjoyment = response.enjoyment; highlights = response.highlights
    }
    public var validationMessage: String? {
        if film == nil { return "Choose a film first." }
        if note.count > 2000 { return "Keep your response under 2,000 characters." }
        if !feelings.hasSelection { return "Choose at least one feeling." }
        if Day.date(from: watchedOn) == nil || watchedOn > Day.string(from: Date()) { return "Choose today or an earlier viewing date." }
        if !["private", "public"].contains(visibility) { return "Choose who can see this response." }
        return nil
    }
    public var input: ResponseInput? { film.map { ResponseInput(movieId: $0.id, watchedOn: watchedOn, note: note,
        visibility: visibility, emotions: feelings, expressionImage: expressionImage, enjoyment: enjoyment,
        highlights: highlights ?? [], suggestionId: suggestionId, clientRequestId: editingID == nil ? clientRequestId : nil) } }
}
public struct ResponseInput: Encodable, Sendable {
    public let movieId: Int
    public let watchedOn: String
    public let note: String
    public let visibility: String
    public let emotions: Feelings
    public let expressionImage: String?
    public let enjoyment: Enjoyment?
    public let highlights: [ResponseHighlight]
    public let suggestionId: Int?
    public let clientRequestId: String?
    // Explicit null removes a previous photo when editing.
    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(movieId, forKey: .movieId); try values.encode(watchedOn, forKey: .watchedOn)
        try values.encode(note, forKey: .note); try values.encode(visibility, forKey: .visibility)
        try values.encode(emotions, forKey: .emotions); try values.encode(expressionImage, forKey: .expressionImage)
        try values.encode(enjoyment, forKey: .enjoyment); try values.encode(highlights, forKey: .highlights)
        try values.encodeIfPresent(suggestionId, forKey: .suggestionId); try values.encodeIfPresent(clientRequestId, forKey: .clientRequestId)
    }
    enum CodingKeys: String, CodingKey { case movieId, watchedOn, note, visibility, emotions, expressionImage, enjoyment, highlights, suggestionId, clientRequestId }
}

public enum Day {
    public static func timestamp(from value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
    public static func string(from date: Date) -> String {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    public static func date(from value: String) -> Date? {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard value.count == 10, let date = formatter.date(from: value), string(from: date) == value else { return nil }
        return date
    }
}

public enum Artwork {
    public static func url(path: String?, width: Int = 500) -> URL? {
        guard let path, path.hasPrefix("/"), !path.hasPrefix("//"), !path.contains(".."),
              !path.contains("?"), !path.contains("#"), !path.contains(":") else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w\(width)\(path)")
    }
}

public struct LibraryStatusResult: Decodable, Sendable { public let films: [LibraryFilmStatus] }
public struct LibraryFilmStatus: Decodable, Identifiable, Sendable { public let id: Int; public let saved: Bool; public let viewingCount: Int }
