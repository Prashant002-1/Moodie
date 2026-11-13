import SwiftUI
import MoodieCore

@main
struct MoodieApp: App {
    private let state: AppState?
    private let configurationError: String?
    init() {
        do { state = AppState(api: try AppConfiguration.client()); configurationError = nil }
        catch { state = nil; configurationError = error.localizedDescription }
    }
    var body: some Scene {
        WindowGroup {
            if let state { RootView().environment(state).tint(MoodieTheme.accent) }
            else { ContentUnavailableView("Unable to connect", systemImage: "network.slash",
                description: Text(configurationError ?? "Moodie’s service is unavailable.")) }
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var state
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        @Bindable var state = state
        Group {
            switch state.session {
            case .loading: LaunchView()
            case .signedOut: AuthView()
            case .signedIn:
                // A new account makes one choice before anything else is shown. The
                // recovery-code sheet comes first so the two never compete.
                if state.user?.aiMode == nil && state.recoveryCode == nil { WelcomeChoiceView() } else { MainTabs() }
            case .unavailable:
                ContentUnavailableView {
                    Label("Couldn’t reconnect", systemImage: "wifi.exclamationmark")
                } description: { Text(state.startupError ?? "Check your connection and try again.") }
                actions: {
                    Button("Try again") { Task { await state.restore() } }.buttonStyle(.borderedProminent)
                    Button("Use another account") { Task { await state.forgetLocalSession() } }
                }
            }
        }
        .task { await state.restore() }
        .alert("Couldn’t complete that", isPresented: Binding(get: { state.notice != nil }, set: { if !$0 { state.notice = nil } })) {
            Button("OK", role: .cancel) { state.notice = nil }
        } message: { Text(state.notice ?? "") }
        .sheet(item: $state.composer) { request in ComposerView(request: request).id(request.id) }
        .sheet(isPresented: $state.settingsPresented) { AccountView() }
        .sheet(isPresented: Binding(get: { state.recoveryCode != nil }, set: { if !$0 { state.recoveryCode = nil } })) {
            RecoveryCodeView(code: state.recoveryCode ?? "")
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && state.session == .signedIn { state.revision += 1 }
        }
        .overlay {
            if scenePhase != .active { MoodieTheme.canvas.ignoresSafeArea().overlay { BrandMark(size: 50) } }
        }
    }
}

private struct LaunchView: View {
    var body: some View {
        VStack(spacing: 24) { BrandMark(size: 56); Text("Moodie").font(.system(.largeTitle, design: .serif)); ProgressView() }
            .frame(maxWidth: .infinity, maxHeight: .infinity).background(MoodieTheme.canvas)
    }
}

struct MainTabs: View {
    @Environment(AppState.self) private var state
    var body: some View {
        @Bindable var state = state
        TabView(selection: $state.selectedTab) {
            NavigationStack { HomeView().appDestinations() }.tabItem { Label("Home", systemImage: "house") }.tag(AppTab.home)
            NavigationStack { SearchView().appDestinations() }.tabItem { Label("Search", systemImage: "magnifyingglass") }.tag(AppTab.search)
            NavigationStack { PeopleView().appDestinations() }.tabItem { Label("People", systemImage: "person.2") }.tag(AppTab.people)
            NavigationStack { DiaryView().appDestinations() }.tabItem { Label("Diary", systemImage: "book.closed") }.tag(AppTab.diary)
        }
    }
}
struct MemberRoute: Hashable { let username: String }
struct ResponseRoute: Hashable { let response: FilmResponse }
struct ActivityRoute: Hashable {}
struct ActivityResponseRoute: Hashable { let id: Int }
struct FilmHistoryRoute: Hashable { let film: Film }
struct SuggestionRoute: Hashable { let id: Int }
struct SuggestionsRoute: Hashable { var personId: Int?; var personName: String? }
extension View {
    func appDestinations() -> some View {
        self.navigationDestination(for: Film.self) { FilmDetailView(film: $0) }
            .navigationDestination(for: MemberRoute.self) { MemberView(username: $0.username) }
            .navigationDestination(for: ResponseRoute.self) { ResponseDetailView(response: $0.response) }
            .navigationDestination(for: ActivityResponseRoute.self) { ActivityResponseView(id: $0.id) }
            .navigationDestination(for: ActivityRoute.self) { _ in ActivityView() }
            .navigationDestination(for: FilmHistoryRoute.self) { FilmHistoryView(film: $0.film) }
            .navigationDestination(for: SuggestionRoute.self) { SuggestionDetailView(id: $0.id) }
            .navigationDestination(for: SuggestionsRoute.self) { SuggestionsView(personId: $0.personId, personName: $0.personName) }
    }
}
