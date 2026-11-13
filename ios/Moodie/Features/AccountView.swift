import SwiftUI
import MoodieCore

struct AccountView: View {
    @Environment(AppState.self) private var state
    @State private var bio = ""
    @State private var busy = false
    @State private var saved = false
    @State private var error: String?
    @State private var signingOut = false
    @State private var loaded = false
    @State private var discardChanges = false
    @FocusState private var editingBio: Bool
    private var hasChanges: Bool { bio != (state.user?.bio ?? "") }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Avatar(name: state.user?.username ?? "", size: 50)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(state.user?.username ?? "").font(.headline)
                            Text(state.user?.email ?? "").font(.subheadline).foregroundStyle(MoodieTheme.secondary).privacySensitive()
                        }
                    }.padding(.vertical, 8)
                    TextField("A little about you", text: $bio, axis: .vertical).lineLimit(3...5)
                        .focused($editingBio)
                        .accessibilityLabel("Bio").accessibilityIdentifier("account-bio").disabled(busy)
                    HStack {
                        Text("\(bio.count)/240").font(.caption).foregroundStyle(MoodieTheme.secondary)
                        Spacer()
                        Button(saved ? "Saved" : "Save profile") { Task { await save() } }.disabled(busy || bio.count > 240 || bio == (state.user?.bio ?? ""))
                    }
                } header: { Text("Profile") }
                if let user = state.user {
                    Section {
                        NavigationLink(value: MemberRoute(username: user.username)) { Label("Your public profile", systemImage: "person.crop.rectangle") }
                    }
                }
                Section {
                    NavigationLink { AIModeSettingsView() } label: {
                        LabeledContent("AI", value: state.user?.aiMode == "on" ? "On" : "Off")
                    }.accessibilityIdentifier("account-ai")
                } footer: { Text("Moodie runs on people either way. This decides whether AI is part of your account.") }
                Section("Account") {
                    NavigationLink("Change password") { PasswordView() }
                    NavigationLink("Blocked people") { BlockedPeopleView() }
                    Button("Sign out") { signingOut = true }.disabled(busy)
                }
                Section("About") {
                    NavigationLink("Privacy") { PolicyView(kind: .privacy) }
                    NavigationLink("Community guidelines") { PolicyView(kind: .community) }
                    if let support = AppConfiguration.link("MoodieSupportURL") { Link("Contact support", destination: support) }
                    NavigationLink("Credits") { CreditsView() }
                    LabeledContent("Version", value: "\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"))")
                }
                Section {
                    NavigationLink { DeleteAccountView() } label: { Text("Delete account").foregroundStyle(.red) }
                }
                if let error { Section { InlineError(message: error) } }
            }.scrollContentBackground(.hidden).scrollDismissesKeyboard(.interactively).moodieScreen().navigationTitle("Account").navigationBarTitleDisplayMode(.inline).appDestinations()
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") {
                        editingBio = false
                        if hasChanges { discardChanges = true } else { state.settingsPresented = false }
                    }.disabled(busy) }
                    if editingBio { ToolbarItemGroup(placement: .keyboard) {
                        Spacer(); Button("Done") { editingBio = false }
                    } }
                }
                .interactiveDismissDisabled(hasChanges || busy)
                .onAppear { if !loaded { bio = state.user?.bio ?? ""; loaded = true } }
                .onChange(of: bio) { _, _ in if hasChanges { saved = false } }
                .alert("Keep your profile changes?", isPresented: $discardChanges) {
                    Button("Keep editing", role: .cancel) { }
                    Button("Discard changes", role: .destructive) {
                        // A sheet can retain its state during a quick re-presentation.
                        bio = state.user?.bio ?? ""; loaded = false; state.settingsPresented = false
                    }
                    Button("Save changes") { Task { if await save() { state.settingsPresented = false } } }.disabled(bio.count > 240)
                }
                .confirmationDialog("Sign out of Moodie?", isPresented: $signingOut, titleVisibility: .visible) {
                    Button("Sign out") { Task { await signOut() } }
                } message: { Text("Your diary is saved to your account. Any draft on this device will be removed.") }
        }
    }
    @discardableResult private func save() async -> Bool {
        busy = true; error = nil; defer { busy = false }
        do { let result: AuthResult = try await state.api.send("auth/profile", method: "PATCH", body: ["bio": bio]); state.user = result.user; bio = result.user.bio ?? ""; saved = true; state.revision += 1; return true }
        catch { self.error = error.localizedDescription; return false }
    }
    private func signOut() async {
        busy = true; defer { busy = false }
        do { try await state.signOut() } catch { self.error = error.localizedDescription }
    }
}

struct PasswordView: View {
    @Environment(AppState.self) private var state
    @State private var current = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var error: String?
    @State private var success = false
    var body: some View {
        Form {
            Section {
                SecureField("Current password", text: $current).textContentType(.password)
                SecureField("New password", text: $password).textContentType(.newPassword)
                SecureField("Repeat new password", text: $confirm).textContentType(.newPassword)
            } footer: { Text("Use at least 10 characters. Changing your password signs out your other sessions.") }
            Button("Change password") { Task { await change() } }.disabled(busy || current.isEmpty || password.count < 10 || password.count > 128 || password != confirm)
            if busy { ProgressView() }
            if let error { InlineError(message: error) }
            if success { Label("Password changed", systemImage: "checkmark.circle") }
        }.navigationTitle("Change password").navigationBarTitleDisplayMode(.inline)
    }
    private func change() async {
        busy = true; error = nil; success = false; defer { busy = false }
        do {
            try await state.api.mutate("auth/password", body: ["currentPassword": current, "password": password])
            current = ""; password = ""; confirm = ""; success = true
        } catch { self.error = error.localizedDescription }
    }
}

struct DeleteAccountView: View {
    @Environment(AppState.self) private var state
    @State private var password = ""
    @State private var confirm = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        Form {
            Section {
                Text("Delete your account").font(.system(.title2, design: .serif))
                Text("This permanently removes your account, diary, photos, saved films, follows, likes, and comments. This cannot be undone.")
                SecureField("Confirm with your password", text: $password).textContentType(.password)
            }
            Button("Delete my account", role: .destructive) { confirm = true }.disabled(password.isEmpty || busy)
            if busy { ProgressView("Deleting account…") }
            if let error { InlineError(message: error) }
        }.navigationTitle("Delete account").navigationBarTitleDisplayMode(.inline)
            .alert("Permanently delete your account?", isPresented: $confirm) {
                Button("Keep account", role: .cancel) { }
                Button("Delete account", role: .destructive) { Task { await remove() } }
            } message: { Text("All your Moodie data will be removed.") }
    }
    private func remove() async {
        busy = true; error = nil; defer { busy = false }
        do {
            try await state.api.mutate("auth/account", method: "DELETE", body: ["password": password])
            if let id = state.user?.id { try? await state.drafts.remove(userID: id) }
            try await state.api.clearSession(); password = ""; state.clearLocalState()
        } catch { self.error = error.localizedDescription }
    }
}

enum PolicyKind { case privacy, community }
struct PolicyView: View {
    let kind: PolicyKind
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if kind == .privacy {
                    Text("Your diary belongs to you.").font(.system(.title, design: .serif))
                    Text("Moodie stores your account email, username, profile, film responses, selected feelings, saved films, and social activity to provide the service.")
                    Text("New responses default to private. Private notes and photos are not shown to other people. Your selected feelings can help find connections with public responses to films you’ve both seen.")
                    Text("Photos are optional. Moodie does not analyze faces, infer emotions from photos, or use photos for recommendations. The photo picker shares only the image you select.")
                    Text("Your session is kept in this device’s Keychain. Unsaved drafts stay on this device and are excluded from backup. Signing out removes local drafts. Moodie does not include advertising or tracking SDKs.")
                    Text("You can edit or delete a response in Diary. Delete your account in Account to remove your account and associated content.")
                    if let url = AppConfiguration.link("MoodiePrivacyURL") { Link("Read the full privacy policy", destination: url) }
                } else {
                    Text("Make room for a different response.").font(.system(.title, design: .serif))
                    Text("Speak from your own experience. A film can mean something different to someone else.")
                    Text("Harassment, threats, hate speech, sexual exploitation, graphic violence, spam, and sharing someone’s private information are not allowed. Only upload images you have the right to share.")
                    Text("Report a response, comment, or person from their options menu. Reports are sent for review. Blocking a person removes their content from your experience and prevents direct interaction.")
                    Text("Content that breaks these guidelines may be removed. Accounts that repeatedly violate them may be restricted.")
                    if let url = AppConfiguration.link("MoodieSupportURL") { Link("Contact support", destination: url) }
                }
            }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity).textSelection(.enabled)
        }.moodieScreen().navigationTitle(kind == .privacy ? "Privacy" : "Community guidelines").navigationBarTitleDisplayMode(.inline)
    }
}
struct CreditsView: View {
    var body: some View {
        List {
            Section("Film information") {
                Image("TMDB").resizable().scaledToFit().frame(width: 88, height: 62).accessibilityLabel("TMDB")
                Text("This product uses the TMDB API but is not endorsed or certified by TMDB.")
                Link("The Movie Database", destination: URL(string: "https://www.themoviedb.org")!)
            }
            Section("Made for how films feel") { Text("Moodie connects films through people’s first-person responses and the feelings they choose to share.") }
        }.navigationTitle("Credits")
    }
}
