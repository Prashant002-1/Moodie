import SwiftUI
import MoodieCore

struct AuthView: View {
    @Environment(AppState.self) private var state
    @State private var mode = Mode.signIn
    @State private var identifier = ""
    @State private var username = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var recovery = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Field?
    enum Mode: String, CaseIterable { case signIn = "Sign in", register = "Sign up", recover = "Recover account" }
    enum Field { case identifier, username, password, confirmation, recovery }
    var valid: Bool {
        !identifier.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
            && (mode != .register || (username.count >= 3 && password.count >= 10 && identifier.contains("@")))
            && (mode != .recover || (!recovery.isEmpty && password.count >= 10))
            && (mode == .signIn || password == confirmation)
    }
    var body: some View {
        NavigationStack {
            ScrollViewReader { scroll in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack(spacing: 10) { BrandMark(); Text("Moodie").font(.system(.title2, design: .serif)) }
                        .padding(.top, 24).id("account-start")
                    if mode == .register {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("No two people feel the same.").font(.system(.largeTitle, design: .serif))
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Keep what a film left with you. Find your next one through someone else.")
                                .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                        }
                    } else if mode == .recover {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recover your account").font(.system(.title, design: .serif))
                            Text("Use the recovery code you saved when you created your account.")
                                .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                        }
                    }
                    VStack(alignment: .leading, spacing: 18) {
                        if mode != .recover {
                            ReadingTabs(choices: ["Sign in", "Sign up"], selection: Binding(
                                get: { mode.rawValue }, set: { mode = $0 == "Sign up" ? .register : .signIn }))
                                .disabled(busy)
                        }
                        field(mode == .register ? "Email" : "Email or username") {
                            TextField(mode == .register ? "you@example.com" : "Your email or username", text: $identifier)
                                .textContentType(mode == .register ? .emailAddress : .username)
                                .keyboardType(mode == .register ? .emailAddress : .default)
                                .focused($focused, equals: .identifier).accessibilityIdentifier("auth-identifier")
                                .submitLabel(.next).onSubmit { focused = mode == .register ? .username : mode == .recover ? .recovery : .password }
                        }
                        if mode == .register {
                            field("Username") {
                                TextField("Choose a username", text: $username).textContentType(.username)
                                    .focused($focused, equals: .username).submitLabel(.next)
                                    .onSubmit { focused = .password }.accessibilityIdentifier("auth-username")
                            }
                            Text("3–30 lowercase letters, numbers, or underscores.").font(.caption).foregroundStyle(MoodieTheme.secondary)
                        }
                        if mode == .recover {
                            field("Recovery code") {
                                TextField("Your saved recovery code", text: $recovery).privacySensitive()
                                    .focused($focused, equals: .recovery)
                                    .submitLabel(.next).onSubmit { focused = .password }
                            }
                        }
                        field(mode == .recover ? "New password" : "Password") {
                            SecureField(mode == .signIn ? "Password" : "At least 10 characters", text: $password)
                                .textContentType(mode == .signIn ? .password : .newPassword)
                                .focused($focused, equals: .password).submitLabel(mode == .signIn ? .go : .next)
                                .onSubmit { if mode != .signIn { focused = .confirmation } else if valid { Task { await submit() } } }.accessibilityIdentifier("auth-password")
                        }
                        if mode != .signIn {
                            field("Confirm password") {
                                SecureField("Repeat your password", text: $confirmation).textContentType(.newPassword).focused($focused, equals: .confirmation)
                                    .submitLabel(.go).onSubmit { if valid { Task { await submit() } } }
                                    .accessibilityIdentifier("auth-password-confirmation")
                            }
                        }
                        if let error { InlineError(message: error).accessibilityIdentifier("auth-error") }
                        Button { Task { await submit() } } label: {
                            HStack { Spacer(); if busy { ProgressView().tint(MoodieTheme.canvas) }; Text(mode.rawValue); Spacer() }
                        }.buttonStyle(MoodieActionStyle()).disabled(!valid || busy).accessibilityIdentifier("auth-submit")
                        if mode == .signIn {
                            Button("Forgot your password?") { mode = .recover; error = nil; password = "" }
                                .font(.subheadline).frame(minHeight: 44).disabled(busy)
                        } else if mode == .recover {
                            Button("Back to sign in") { mode = .signIn; error = nil; password = "" }
                                .font(.subheadline).frame(minHeight: 44).disabled(busy)
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        if mode == .register { Text("Your diary starts private. You choose which responses to share.").font(.footnote) }
                        WrappingLayout(spacing: 20, rowSpacing: 0) {
                            NavigationLink("Privacy") { PolicyView(kind: .privacy) }.frame(minHeight: 44)
                            NavigationLink("Community guidelines") { PolicyView(kind: .community) }.frame(minHeight: 44)
                        }.font(.footnote)
                    }.foregroundStyle(MoodieTheme.secondary)
                }.frame(maxWidth: 470).padding(.horizontal, 24).padding(.bottom, 30).frame(maxWidth: .infinity)
            }.scrollDismissesKeyboard(.interactively).moodieScreen()
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .onChange(of: mode) { _, _ in
                    error = nil; password = ""; confirmation = ""; focused = nil
                    scroll.scrollTo("account-start", anchor: .top)
                }
            }
        }
    }
    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.medium))
            content().accessibilityLabel(title).disabled(busy)
                .padding(14).background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(MoodieTheme.rule, lineWidth: 0.6))
        }
    }
    private func submit() async {
        guard valid && !busy else { return }
        busy = true; error = nil; focused = nil
        defer { busy = false }
        do {
            let result: AuthResult
            switch mode {
            case .signIn: result = try await state.api.send("auth/login", body: SignInInput(identifier: identifier, password: password))
            case .register: result = try await state.api.send("auth/register", body: RegisterInput(email: identifier, username: username, password: password))
            case .recover: result = try await state.api.send("auth/recover", body: RecoverInput(identifier: identifier, recoveryCode: recovery, password: password))
            }
            password = ""; confirmation = ""; recovery = ""; await state.accept(result)
        } catch { self.error = error.localizedDescription }
    }
}

struct RecoveryCodeView: View {
    @Environment(AppState.self) private var state
    let code: String
    @State private var saved = false
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Keep your recovery code").font(.system(.title, design: .serif))
                    Text("Save this in your password manager. You’ll need it to reset your password if you lose access.")
                    Text(code).font(.body.monospaced()).textSelection(.enabled).privacySensitive()
                }
                Section {
                    Toggle("I’ve saved my recovery code", isOn: $saved)
                    Button("Continue") { state.recoveryCode = nil }.disabled(!saved)
                }
            }.navigationTitle("Account recovery").navigationBarTitleDisplayMode(.inline)
                .interactiveDismissDisabled()
        }
    }
}
