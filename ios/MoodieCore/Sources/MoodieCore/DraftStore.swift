import Foundation

/// Per-account drafts are written atomically and never placed in cloud backup.
public actor DraftStore {
    private let directory: URL
    public init(directory: URL) { self.directory = directory }
    public func load(userID: Int) throws -> ResponseDraft? {
        let url = file(userID)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try JSONDecoder().decode(ResponseDraft.self, from: Data(contentsOf: url))
    }
    public func save(_ draft: ResponseDraft, userID: Int) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(draft)
        #if os(iOS)
        try data.write(to: file(userID), options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: file(userID), options: .atomic)
        #endif
        var url = file(userID); var values = URLResourceValues(); values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }
    public func remove(userID: Int) throws {
        let url = file(userID)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
    private func file(_ id: Int) -> URL { directory.appendingPathComponent("draft-\(id).json") }
}
