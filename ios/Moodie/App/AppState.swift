import SwiftUI
import Observation
import MoodieCore

@MainActor @Observable
final class AppState {
    enum Session { case loading, signedOut, signedIn, unavailable }
    let api: APIClient
    let drafts: DraftStore
    var session = Session.loading
    var user: Member?
    var startupError: String?
    var notice: String?
    var recoveryCode: String?
    // Small home/search preview. Complete saved history is loaded by its own screen.
    var saved: [SavedFilm] = []
    var savedStatus: [Int: Bool] = [:]
    var savedStatusErrors: [Int: String] = [:]
    var keptRecommendations: [Int: Int] = [:]
    var revision = 0
    var composer: ComposerRequest?
    var settingsPresented = false
    var selectedTab = AppTab.home
    var isMutating = Set<String>()

    init(api: APIClient) {
        self.api = api
        let root = URL.applicationSupportDirectory.appendingPathComponent("Moodie", isDirectory: true)
        drafts = DraftStore(directory: root.appendingPathComponent("Drafts", isDirectory: true))
    }
    func restore() async {
        await api.observeExpiry { @MainActor [weak self] in self?.clearLocalState() }
        session = .loading
        do {
            guard try await api.hasCredential() else { session = .signedOut; return }
            let result: AuthResult = try await api.get("auth/me")
            user = result.user; session = .signedIn
            await refreshSaved()
        } catch APIError.signedOut { clearLocalState() }
        catch { startupError = error.localizedDescription; session = .unavailable }
    }
    func accept(_ result: AuthResult) async {
        user = result.user; recoveryCode = result.recoveryCode
        session = .signedIn; revision += 1
        await refreshSaved()
    }
    /// The AI choice belongs to the account, so it is saved on the server, never only on this device.
    func setAIMode(_ mode: AIMode) async throws {
        let result: AuthResult = try await api.send("auth/preferences", method: "PATCH", body: ["aiMode": mode.rawValue])
        user = result.user
    }
    func handle(_ error: Error) {
        if error is CancellationError || (error as? URLError)?.code == .cancelled { return }
        if error as? APIError == .signedOut { clearLocalState() }
        notice = error.localizedDescription
    }
    func clearLocalState() {
        user = nil; saved = []; savedStatus = [:]; savedStatusErrors = [:]; keptRecommendations = [:]; recoveryCode = nil; composer = nil
        settingsPresented = false; selectedTab = .home; session = .signedOut; revision += 1
    }
    func signOut() async throws {
        try await api.mutate("auth/logout", body: EmptyBody())
        if let user { try await drafts.remove(userID: user.id) }
        try await api.clearSession(); clearLocalState()
    }
    func forgetLocalSession() async {
        do {
            if let user { try await drafts.remove(userID: user.id) }
            try await api.clearSession(); clearLocalState()
        } catch { handle(error) }
    }
    func refreshSaved() async {
        let owner = user?.id
        do {
            let result: SavedResult = try await api.get("library/saved", query: ["limit": "12"])
            try Task.checkCancellation(); guard owner == user?.id else { return }
            saved = result.films
        } catch { if owner == user?.id { handle(error) } }
    }
    func isSaved(_ id: Int) -> Bool { savedStatus[id] == true }
    func loadSavedStatus(_ ids: [Int]) async {
        let owner = user?.id, version = revision
        let unique = Array(Set(ids))
        guard !unique.isEmpty, owner != nil else { return }
        for id in unique { savedStatusErrors[id] = nil }
        do {
            for start in stride(from: 0, to: unique.count, by: 100) {
                let batch = Array(unique[start..<min(start + 100, unique.count)])
                let result: LibraryStatusResult = try await api.get("library/status", query: ["movieIds": batch.map(String.init).joined(separator: ",")])
                try Task.checkCancellation(); guard owner == user?.id, version == revision else { return }
                for film in result.films { savedStatus[film.id] = film.saved }
            }
        } catch { if owner == user?.id && !Task.isCancelled { for id in unique { savedStatusErrors[id] = error.localizedDescription } } }
    }
    func toggleSaved(_ film: Film) async {
        let key = "save-\(film.id)", owner = user?.id
        guard isMutating.insert(key).inserted else { return }
        defer { isMutating.remove(key) }
        do {
            // Read current membership before a toggle, never infer it from the preview.
            let status: LibraryStatusResult = try await api.get("library/status", query: ["movieIds": String(film.id)])
            guard owner == user?.id, let current = status.films.first else { return }
            if current.saved { try await api.mutate("library/saved/\(film.id)", method: "DELETE", body: EmptyBody()) }
            else { try await api.mutate("library/saved", body: ["movieId": film.id]) }
            guard owner == user?.id else { return }
            savedStatus[film.id] = !current.saved; revision += 1
            await refreshSaved()
        } catch { if owner == user?.id { handle(error) } }
    }

}

enum AppTab: Hashable { case home, search, people, diary }

struct ComposerRequest: Identifiable {
    let id = UUID()
    var film: Film?
    var response: FilmResponse?
    var suggestion: FilmSuggestion?
}

struct SuggestionComposerRequest: Identifiable {
    let id = UUID()
    var film: Film?
    var recipient: Member?
    var sourceEntryId: Int?
}

enum AppConfiguration {
    static func client() throws -> APIClient {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "MoodieAPIURL") as? String,
              let url = URL(string: raw), !raw.contains("$(") else { throw APIError.invalidConfiguration }
        #if DEBUG
        let allowLocalHTTP = true
        #else
        let allowLocalHTTP = false
        #endif
        return try APIClient(baseURL: url,
            credentials: KeychainStore(service: "\(Bundle.main.bundleIdentifier ?? "Moodie").\(url.host ?? "service").\(url.port ?? 443)"),
            allowLocalHTTP: allowLocalHTTP)
    }
    static func link(_ key: String) -> URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              let url = URL(string: raw), url.scheme == "https", url.host != nil, !raw.contains("$(") else { return nil }
        return url
    }
}
