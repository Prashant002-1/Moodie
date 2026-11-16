import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum APIError: Error, LocalizedError, Equatable, Sendable {
    case invalidConfiguration, invalidResponse, signedOut, server(Int, String), insecureURL, missingSession
    public var errorDescription: String? {
        switch self {
        case .invalidConfiguration: "Moodie’s service address is not configured."
        case .invalidResponse: "The service sent an unexpected response. Please try again."
        case .signedOut: "Your session ended. Sign in to continue."
        case .server(_, let message): message
        case .insecureURL: "Moodie needs a secure connection."
        case .missingSession: "Your sign-in could not be saved securely. Please try again."
        }
    }
}

public struct SessionCredential: Codable, Equatable, Sendable {
    public let token: String
    public let expiresAt: Date
    public init(token: String, expiresAt: Date) { self.token = token; self.expiresAt = expiresAt }
}
public protocol CredentialStore: Sendable {
    func read() throws -> SessionCredential?
    func write(_ credential: SessionCredential?) throws
}

private final class SameOriginRedirects: NSObject, URLSessionTaskDelegate, Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        guard let original = task.originalRequest?.url, let target = request.url,
              original.scheme == target.scheme, original.host == target.host,
              original.port == target.port else { completionHandler(nil); return }
        completionHandler(request)
    }
}

public actor APIClient {
    public let baseURL: URL
    private let credentials: any CredentialStore
    private let session: URLSession
    private var generation = 0
    private var expiryHandler: (@Sendable () async -> Void)?

    public init(baseURL: URL, credentials: any CredentialStore, session: URLSession? = nil,
                allowLocalHTTP: Bool = false) throws {
        guard let components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false),
              let host = components.host, components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil else { throw APIError.invalidConfiguration }
        let isLoopback = ["localhost", "127.0.0.1", "::1"].contains(host)
        guard components.scheme == "https" || (allowLocalHTTP && isLoopback && components.scheme == "http") else {
            throw APIError.insecureURL
        }
        self.baseURL = baseURL; self.credentials = credentials
        if let session { self.session = session } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpShouldSetCookies = false
            configuration.httpCookieStorage = nil
            configuration.urlCache = nil
            configuration.timeoutIntervalForRequest = 25
            configuration.timeoutIntervalForResource = 45
            self.session = URLSession(configuration: configuration, delegate: SameOriginRedirects(), delegateQueue: nil)
        }
    }

    public func observeExpiry(_ handler: @escaping @Sendable () async -> Void) { expiryHandler = handler }

    public func hasCredential() throws -> Bool {
        guard let credential = try credentials.read() else { return false }
        if credential.expiresAt <= Date() { try credentials.write(nil); return false }
        return true
    }
    public func clearSession() throws { generation += 1; try credentials.write(nil) }

    public func get<T: Decodable & Sendable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await decode(path, method: "GET", query: query, body: nil)
    }
    public func send<T: Decodable & Sendable, Body: Encodable & Sendable>(
        _ path: String, method: String = "POST", body: Body
    ) async throws -> T {
        try await decode(path, method: method, query: [:], body: JSONEncoder().encode(body))
    }
    public func mutate<Body: Encodable & Sendable>(_ path: String, method: String = "POST", body: Body) async throws {
        _ = try await perform(path, method: method, query: [:], body: JSONEncoder().encode(body))
    }
    private func decode<T: Decodable & Sendable>(_ path: String, method: String, query: [String: String], body: Data?) async throws -> T {
        let data = try await perform(path, method: method, query: query, body: body)
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.invalidResponse }
    }
    private func perform(_ path: String, method: String, query: [String: String], body: Data?) async throws -> Data {
        guard !path.contains(".."), !path.contains(":"), !path.contains("?"), !path.contains("#"), !path.hasPrefix("/") else {
            throw APIError.invalidConfiguration
        }
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidConfiguration
        }
        if !query.isEmpty { components.queryItems = query.sorted { $0.key < $1.key }.map(URLQueryItem.init) }
        guard let url = components.url else { throw APIError.invalidConfiguration }
        var request = URLRequest(url: url)
        request.httpMethod = method; request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: "X-Moodie-Request")
        if let credential = try credentials.read(), credential.expiresAt > Date() {
            request.setValue("moodie_session=\(credential.token)", forHTTPHeaderField: "Cookie")
        }
        let requestGeneration = generation
        let (data, response) = try await session.data(for: request)
        try Task.checkCancellation()
        guard requestGeneration == generation else { throw CancellationError() }
        guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if response.statusCode == 401 {
            if !["auth/login", "auth/register", "auth/recover"].contains(path) {
                try clearSession(); await expiryHandler?(); throw APIError.signedOut
            }
        }
        guard (200..<300).contains(response.statusCode) else {
            struct Failure: Decodable { let error: String }
            let message = (try? JSONDecoder().decode(Failure.self, from: data).error)
                ?? "That request could not be completed. Please try again."
            throw APIError.server(response.statusCode, message)
        }
        if let header = response.value(forHTTPHeaderField: "Set-Cookie") {
            let cookies = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": header], for: url)
            if let cookie = cookies.first(where: { $0.name == "moodie_session" }) {
                if cookie.value.isEmpty || (cookie.expiresDate ?? .distantFuture) <= Date() { try credentials.write(nil) }
                else if cookie.value.count == 64 && cookie.value.allSatisfy({ $0.isHexDigit && !$0.isUppercase }) {
                    try credentials.write(SessionCredential(token: cookie.value, expiresAt: cookie.expiresDate ?? Date().addingTimeInterval(30 * 86400)))
                } else { throw APIError.missingSession }
            }
        }
        if ["auth/login", "auth/register", "auth/recover"].contains(path), try !hasCredential() {
            throw APIError.missingSession
        }
        return data
    }
}

public struct EmptyBody: Encodable, Sendable { public init() {} }
public struct SignInInput: Encodable, Sendable {
    public let identifier: String; public let password: String
    public init(identifier: String, password: String) { self.identifier = identifier; self.password = password }
}
public struct RegisterInput: Encodable, Sendable {
    public let email: String; public let username: String; public let password: String
    public init(email: String, username: String, password: String) { self.email = email; self.username = username; self.password = password }
}
public struct RecoverInput: Encodable, Sendable {
    public let identifier: String; public let recoveryCode: String; public let password: String
    public init(identifier: String, recoveryCode: String, password: String) {
        self.identifier = identifier; self.recoveryCode = recoveryCode; self.password = password
    }
}
