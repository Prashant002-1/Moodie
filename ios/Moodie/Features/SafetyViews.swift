import SwiftUI
import MoodieCore

enum ReportTarget {
    case response(Int), comment(Int), person(Int)
    var kind: String { switch self { case .response: "response"; case .comment: "comment"; case .person: "person" } }
    var id: Int { switch self { case .response(let id), .comment(let id), .person(let id): id } }
}
struct ReportView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let target: ReportTarget
    let personID: Int
    @State private var reason = "Harassment"
    @State private var details = ""
    @State private var block = false
    @State private var busy = false
    @State private var error: String?
    @State private var sent = false
    @State private var blocked = false
    var body: some View {
        NavigationStack {
            Form {
                if sent {
                    Section {
                        Label("Report received", systemImage: "checkmark.circle")
                        Text("Thank you. This has been added to the moderation queue.")
                        if blocked { Text("This person is blocked. Follows between you have been removed.") }
                        if block && !blocked { Button("Retry block") { Task { await saveBlock() } }.disabled(busy) }
                        Button("Done") { dismiss() }
                    }
                } else {
                    Section {
                        Picker("Reason", selection: $reason) {
                            ForEach(["Harassment", "Hate or threats", "Sexual content", "Violence", "Spam", "Privacy", "Other"], id: \.self) { Text($0).tag($0) }
                        }
                        TextField("Anything else we should know?", text: $details, axis: .vertical).lineLimit(3...6)
                    } footer: { Text("Your report is private. Please don’t include sensitive personal information.") }
                    Section {
                        Toggle("Also block this person", isOn: $block)
                        Button("Send report", role: .destructive) { Task { await submit() } }.disabled(busy || details.count > 1000)
                    }
                }
                if busy { ProgressView() }
                if let error { InlineError(message: error) }
            }.navigationTitle("Report").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) } }
        }
    }
    private func submit() async {
        busy = true; error = nil; defer { busy = false }
        struct Input: Encodable { let targetKind: String; let targetId: Int; let reason: String; let details: String }
        do {
            try await state.api.mutate("safety/reports", body: Input(targetKind: target.kind, targetId: target.id, reason: reason, details: details))
            sent = true; state.revision += 1
            if block { await saveBlock() }
        } catch { self.error = error.localizedDescription }
    }
    private func saveBlock() async {
        busy = true; error = nil; defer { busy = false }
        do {
            try await state.api.mutate("safety/blocks/\(personID)", body: EmptyBody())
            blocked = true; state.revision += 1
        } catch { self.error = "Your report was received, but the block could not be saved. \(error.localizedDescription)" }
    }
}
struct BlockedPeopleView: View {
    @Environment(AppState.self) private var state
    @State private var people: [Member] = []
    @State private var error: String?
    @State private var loaded = false
    @State private var nextOffset: Int?
    @State private var busy = false
    @State private var notice: String?
    var body: some View {
        List {
            ForEach(people) { person in
                HStack {
                    Text(person.username); Spacer()
                    Button("Unblock") { Task { await unblock(person) } }.buttonStyle(.bordered).disabled(busy)
                }
            }
            if loaded && people.isEmpty { ContentUnavailableView("No blocked people", systemImage: "person.crop.circle.badge.checkmark") }
            if let nextOffset { Button("More people") { Task { await load(offset: nextOffset) } }.disabled(busy) }
            if busy { ProgressView() }
            if let notice { Text(notice) }
            if let error { InlineError(message: error) { Task { await load() } } }
        }.navigationTitle("Blocked people").task { await load() }
    }
    private func load(offset: Int? = nil) async {
        busy = true; defer { busy = false }
        do {
            let result: BlockedResult = try await state.api.get("safety/blocks?limit=30&offset=\(offset ?? 0)")
            if offset == nil { people = result.people } else {
                let ids = Set(people.map(\.id)); people += result.people.filter { !ids.contains($0.id) }
            }
            nextOffset = result.nextOffset; error = nil; loaded = true
        }
        catch { self.error = error.localizedDescription }
    }
    private func unblock(_ person: Member) async {
        guard !busy else { return }
        busy = true; error = nil; notice = nil; defer { busy = false }
        do {
            try await state.api.mutate("safety/blocks/\(person.id)", method: "DELETE", body: EmptyBody())
            people.removeAll { $0.id == person.id }
            notice = "\(person.username) is unblocked. Follows have not been restored."
            state.revision += 1; await load()
        }
        catch { self.error = error.localizedDescription }
    }
}
