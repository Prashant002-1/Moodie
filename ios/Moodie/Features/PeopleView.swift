import SwiftUI
import MoodieCore

struct PeopleView: View {
    @Environment(AppState.self) private var state
    @State private var people: [Member] = []
    @State private var section = "Discover"
    @State private var loading = true
    @State private var error: String?
    @State private var query = ""
    @State private var offset: Int?
    @State private var request = UUID()
    @State private var loadedKey = ""
    private var requestKey: String { "\(state.user?.id ?? 0):\(state.revision):\(section):\(query)" }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                ReadingTabs(choices: ["Discover", "Following"], selection: $section).padding(.top, 4)
                ForEach(people) { PersonRow(person: $0); Divider() }
                if offset != nil { Button("More people") { Task { await load(more: true) } }.disabled(loading) }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                if let error { InlineError(message: error) { Task { await load() } } }
                if !loading && error == nil && people.isEmpty {
                    ContentUnavailableView {
                        Label(query.isEmpty ? (section == "Following" ? "Your circle starts here" : people.isEmpty ? "People will appear here" : "You’re caught up") : "No people found", systemImage: "person.2")
                    } description: {
                        Text(query.isEmpty ? (section == "Following" ? "Follow someone whose responses you want to return to." : "New people will appear here as the community grows.") : "Try another name or a word from their bio.")
                    } actions: {
                        if query.isEmpty && !people.isEmpty { Button(section == "Following" ? "Discover people" : "See your circle") { section = section == "Following" ? "Discover" : "Following" } }
                        else if !query.isEmpty { Button("Clear search") { query = "" } }
                    }
                }
            }.padding(.horizontal, 20).padding(.bottom, 24).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle("People").navigationBarTitleDisplayMode(.inline).task(id: requestKey) { await load() }.refreshable { await load() }
            .searchable(text: $query, prompt: "Name or bio")
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: SuggestionsRoute()) { Label("Recommendations", systemImage: "tray").labelStyle(.iconOnly) }
            } }
    }
    private func load(more: Bool = false) async {
        let key = requestKey, token = UUID(); request = token
        if loadedKey != key { people = []; offset = nil; loadedKey = key }
        loading = true; error = nil
        defer { if request == token { loading = false } }
        do {
            if !more && !query.isEmpty { try await Task.sleep(for: .milliseconds(250)) }
            let result: PeopleResult = try await state.api.get("discovery/people", query: ["limit": "30", "offset": String(more ? offset ?? 0 : 0), "scope": section.lowercased(), "q": query])
            try Task.checkCancellation(); guard key == requestKey, request == token else { return }
            if more { let ids = Set(people.map(\.id)); people += result.people.filter { !ids.contains($0.id) } } else { people = result.people }
            offset = result.nextOffset
        } catch { if !Task.isCancelled && request == token && key == requestKey { people = []; offset = nil; self.error = error.localizedDescription } }
    }

}

struct PersonRow: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let person: Member
    var showsPreview = true
    var linksToProfile = true
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 12))) {
                NavigationLink(value: MemberRoute(username: person.username)) {
                    HStack(spacing: 10) {
                        Avatar(name: person.username, size: 34)
                        Text(person.username).font(.headline).fixedSize(horizontal: false, vertical: true)
                    }.frame(minHeight: 44).contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(!linksToProfile).accessibilityIdentifier("member-\(person.username)")
                if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
                FollowButton(person: person)
            }
            if let shared = person.sharedFilmTitle {
                Text("You both watched \(shared)").font(.caption).foregroundStyle(MoodieTheme.secondary)
            }
            if showsPreview, let title = person.latestTitle {
                NavigationLink(value: MemberRoute(username: person.username)) {
                    HStack(alignment: .top, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(title).font(.system(.headline, design: .serif))
                            if let note = person.latestNote, !note.isEmpty {
                                Text(note).font(.subheadline).lineSpacing(3).lineLimit(3)
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        Poster(path: person.latestPosterPath, width: 44, title: title)
                    }.contentShape(Rectangle())
                }.buttonStyle(.plain)
            } else if showsPreview, let bio = person.bio, !bio.isEmpty {
                Text(bio).font(.subheadline).foregroundStyle(MoodieTheme.secondary)
            }
        }.padding(.vertical, 4)
    }
}

struct FollowButton: View {
    @Environment(AppState.self) private var state
    let person: Member
    @State private var following = false
    @State private var busy = false
    var body: some View {
        if person.id != state.user?.id {
            Button { Task { await toggle() } } label: {
                HStack(spacing: 5) {
                    if following { Image(systemName: "checkmark").font(.caption2.weight(.semibold)) }
                    Text(following ? "Following" : "Follow").font(.caption.weight(.medium))
                }.padding(.horizontal, 12).frame(minHeight: 44)
                    .background(MoodieTheme.ink.opacity(following ? 0.04 : 0.08), in: RoundedRectangle(cornerRadius: 10))
                    .contentShape(Rectangle())
            }.buttonStyle(.plain).disabled(busy).accessibilityIdentifier("follow-\(person.username)")
                .accessibilityLabel(following ? "Unfollow \(person.username)" : "Follow \(person.username)")
                .onAppear { following = person.following ?? false }
                .onChange(of: person.following) { _, value in following = value ?? false }
        }
    }
    private func toggle() async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        do {
            try await state.api.mutate("discovery/people/\(person.id)/follow", method: following ? "DELETE" : "POST", body: EmptyBody())
            following.toggle(); state.revision += 1
        } catch { state.handle(error) }
    }
}

struct MemberView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let username: String
    @State private var entries: [FilmResponse] = []
    @State private var offset: Int?
    @State private var loading = false
    @State private var request = UUID()
    @State private var loadedKey = ""
    private var requestKey: String { "\(state.user?.id ?? 0):\(username):\(section):\(state.revision)" }
    @State private var profile: ProfileResult?
    @State private var section = "Responses"
    @State private var error: String?
    @State private var report = false
    @State private var blocking = false
    @State private var blockBusy = false
    private var followerCount: Int { profile?.person.followers ?? profile?.followers?.count ?? 0 }
    private var followingCount: Int { profile?.person.followingCount ?? profile?.following?.count ?? 0 }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                if let profile {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(alignment: .top, spacing: 16) {
                            Avatar(name: profile.person.username, size: 52)
                            VStack(alignment: .leading, spacing: 8) {
                                Text(profile.person.username).font(.system(.title, design: .serif))
                                    .fixedSize(horizontal: false, vertical: true)
                                if let bio = profile.person.bio, !bio.isEmpty {
                                    Text(bio).font(.subheadline).lineSpacing(3).foregroundStyle(MoodieTheme.secondary)
                                }
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                        WrappingLayout(spacing: 16, rowSpacing: 4) {
                            FollowButton(person: profile.person)
                            NavigationLink("\(followerCount) \(followerCount == 1 ? "follower" : "followers")") {
                                MemberConnectionsView(username: username, kind: .followers)
                            }.frame(minHeight: 44)
                            NavigationLink("\(followingCount) following") {
                                MemberConnectionsView(username: username, kind: .following)
                            }.frame(minHeight: 44)
                        }.font(.caption).foregroundStyle(MoodieTheme.secondary)
                        if let shared = profile.person.sharedFilmTitle {
                            Text("You both watched \(shared)").font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                        }
                        if profile.person.id != state.user?.id {
                            HStack(spacing: 16) {
                                NavigationLink(value: SuggestionsRoute(personId: profile.person.id, personName: profile.person.username)) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Between you").font(.subheadline.weight(.medium))
                                        Text("Recommendations and replies").font(.caption).foregroundStyle(MoodieTheme.secondary)
                                    }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
                                }.buttonStyle(.plain).accessibilityIdentifier("member-recommendations")
                                if profile.person.followsYou == true {
                                    RecommendFilmButton(title: "Recommend to \(profile.person.username)", recipient: profile.person, iconOnly: true)
                                        .accessibilityIdentifier("recommend-to-member")
                                } else { Image(systemName: "chevron.right").font(.caption2).foregroundStyle(MoodieTheme.secondary) }
                            }.padding(14).background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }.padding(.top, 8)
                    Text("\(profile.person.films ?? 0) films").font(.caption).foregroundStyle(MoodieTheme.secondary)
                    ReadingTabs(choices: ["Responses", "Films"], selection: $section)
                    if section == "Responses" {
                        ForEach(entries) { ResponseCard(response: $0, showsAuthor: false); Divider() }
                    } else {
                        ForEach(entries) { response in NavigationLink(value: response.film) { FilmRow(film: response.film) }.buttonStyle(.plain) }
                    }
                    if entries.isEmpty && !loading && error == nil { ContentUnavailableView("No shared responses yet", systemImage: "text.bubble", description: Text("Their public responses will appear here.")) }
                } else if error == nil { ProgressView().frame(maxWidth: .infinity) }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                if offset != nil { Button("More \(section.lowercased())") { Task { await load(more: true) } }.disabled(loading) }
                if let error { InlineError(message: error) { Task { await load() } } }
            }.padding(20).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.moodieScreen().navigationTitle("Profile").navigationBarTitleDisplayMode(.inline)
            .task(id: requestKey) { await load() }.refreshable { await load() }
            .toolbar {
                if let profile, profile.person.id != state.user?.id {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("Report person", systemImage: "flag") { report = true }
                            Button("Block person", systemImage: "hand.raised", role: .destructive) { blocking = true }
                        } label: { Image(systemName: "ellipsis") }.accessibilityLabel("Person options").disabled(blockBusy)
                    }
                }
            }
            .sheet(isPresented: $report) { if let profile { ReportView(target: .person(profile.person.id), personID: profile.person.id) } }
            .confirmationDialog("Block \(username)?", isPresented: $blocking, titleVisibility: .visible) {
                Button("Block person", role: .destructive) { Task { await block() } }
            } message: { Text("You won’t see each other’s responses or interact. Existing follows will be removed. You can unblock them in Account.") }
    }
    private func load(more: Bool = false) async {
        let key = requestKey, token = UUID(); request = token
        if loadedKey != key { entries = []; offset = nil; loadedKey = key }
        loading = true; error = nil
        defer { if request == token { loading = false } }
        do {
            let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username
            let result: ProfileResult = try await state.api.get("discovery/people/\(encoded)", query: ["limit": "30", "offset": String(more ? offset ?? 0 : 0), "view": section.lowercased(), "includeConnections": "false"])
            try Task.checkCancellation(); guard request == token, key == requestKey else { return }
            profile = result
            if more { let ids = Set(entries.map(\.id)); entries += result.entries.filter { !ids.contains($0.id) } } else { entries = result.entries }
            offset = result.nextOffset
        } catch { if !Task.isCancelled && request == token && key == requestKey { self.error = error.localizedDescription; profile = nil; entries = []; offset = nil } }
    }
    private func block() async {
        guard let profile, !blockBusy else { return }; blockBusy = true; defer { blockBusy = false }
        do { try await state.api.mutate("safety/blocks/\(profile.person.id)", body: EmptyBody()); state.revision += 1; dismiss() }
        catch { state.handle(error) }
    }
}

struct MemberConnectionsView: View {
    enum Kind: String { case followers = "Followers", following = "Following" }
    @Environment(AppState.self) private var state
    let username: String
    let kind: Kind
    @State private var people: [Member] = []
    @State private var offset: Int?
    @State private var request = UUID()
    @State private var loading = true
    @State private var error: String?
    var body: some View {
        List {
            ForEach(people) { PersonRow(person: $0, showsPreview: false).padding(.vertical, 8).listRowBackground(Color.clear) }
            if offset != nil { Button("More people") { Task { await load(more: true) } }.disabled(loading) }
            if loading { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if let error { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
            if !loading && error == nil && people.isEmpty {
                ContentUnavailableView(kind == .followers ? "No followers yet" : "Not following anyone yet", systemImage: "person.2")
                    .listRowBackground(Color.clear)
            }
        }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen()
            .navigationTitle(kind.rawValue).navigationBarTitleDisplayMode(.inline)
            .task(id: state.revision) { await load() }.refreshable { await load() }
    }
    private func load(more: Bool = false) async {
        let token = UUID(); request = token
        loading = true; error = nil; defer { if request == token { loading = false } }
        do {
            let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username
            let result: PeopleResult = try await state.api.get("discovery/people/\(encoded)/connections", query: ["kind": kind.rawValue.lowercased(), "limit": "30", "offset": String(more ? offset ?? 0 : 0)])
            try Task.checkCancellation(); guard request == token else { return }
            if more { let ids = Set(people.map(\.id)); people += result.people.filter { !ids.contains($0.id) } } else { people = result.people }
            offset = result.nextOffset
        } catch { if !Task.isCancelled && request == token { people = []; offset = nil; self.error = error.localizedDescription } }
    }
}

struct ActivityView: View {
    @Environment(AppState.self) private var state
    @State private var events: [Activity] = []
    @State private var offset: Int?
    @State private var loaded = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        List {
            ForEach(events) { event in
                activityLink(event) {
                    HStack(alignment: .top, spacing: 12) {
                        Avatar(name: event.username)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(event.username).font(.headline)
                            Text(activityDescription(event))
                                .font(.subheadline).foregroundStyle(MoodieTheme.secondary)
                            if let body = event.commentBody { Text(body).font(.subheadline).lineLimit(3) }
                            else if event.kind == "response", let note = event.note { Text(note).font(.subheadline).lineLimit(3) }
                        }
                    }.padding(.vertical, 6)
                }.listRowBackground(Color.clear)
            }
            if let error { InlineError(message: error) { Task { await load() } }.listRowBackground(Color.clear) }
            if !loaded || busy { ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear) }
            if loaded && events.isEmpty && error == nil { ContentUnavailableView("The conversation continues here", systemImage: "bell", description: Text("Likes, comments, followers, and new responses from your circle will appear here.")).listRowBackground(Color.clear) }
            if offset != nil { Button("Earlier activity") { Task { await load(more: true) } }.disabled(busy) }
        }.listStyle(.plain).scrollContentBackground(.hidden).moodieScreen().navigationTitle("Activity")
            .task(id: state.revision) { await load() }.refreshable { await load() }
    }
    private func activityDescription(_ event: Activity) -> String {
        let title = event.title ?? "a film"
        switch event.kind {
        case "follow": return "Followed you"
        case "like": return "Liked your response to \(title)"
        case "response": return "Responded to \(title)"
        case "suggestion": return "Recommended \(title) to you"
        case "suggestion_reply": return "Told you how \(title) landed"
        case "suggestion_message": return "Continued your conversation about \(title)"
        default: return "Commented on \(title)"
        }
    }
    @ViewBuilder private func activityLink<Content: View>(_ event: Activity, @ViewBuilder label: () -> Content) -> some View {
        if let id = event.suggestionId { NavigationLink(value: SuggestionRoute(id: id), label: label) }
        else if let id = event.entryId { NavigationLink(value: ActivityResponseRoute(id: id), label: label) }
        else { NavigationLink(value: MemberRoute(username: event.username), label: label) }
    }
    private func load(more: Bool = false) async {
        guard !busy else { return }; busy = true; defer { loaded = true; busy = false }
        do {
            let page: ActivityPage = try await state.api.get("discovery/activity", query: ["limit": "40", "offset": String(more ? offset ?? 0 : 0), "includeResponses": "true", "includeSuggestions": "true"])
            if more { let ids = Set(events.map(\.id)); events += page.activity.filter { !ids.contains($0.id) } } else { events = page.activity }
            offset = page.nextOffset; error = nil
        } catch { self.error = error.localizedDescription }
    }
}


struct ActivityResponseView: View {
    @Environment(AppState.self) private var state
    let id: Int
    @State private var response: FilmResponse?
    @State private var error: String?
    var body: some View {
        Group {
            if let response { ResponseDetailView(response: response) }
            else if let error { ContentUnavailableView("Response unavailable", systemImage: "text.bubble", description: Text(error)) }
            else { ProgressView("Opening response…") }
        }.task {
            do { let result: ResponseResult = try await state.api.get("discovery/entries/\(id)"); response = result.entry }
            catch { self.error = error.localizedDescription }
        }
    }
}
