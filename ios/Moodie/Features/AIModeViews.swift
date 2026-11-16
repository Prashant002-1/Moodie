import SwiftUI
import MoodieCore

/// The two ways Moodie can work. The copy is the contract: keep it true to what the server enforces.
enum AIMode: String, CaseIterable, Identifiable {
    case off, on
    var id: String { rawValue }
    var numeral: String { self == .off ? "I" : "II" }
    var title: String { self == .off ? "People only" : "People, with AI" }
    var summary: String {
        self == .off ? "Films reach you through people, and nothing else."
            : "Everything in People only, with AI available when you ask for it."
    }
    var points: [String] {
        switch self {
        case .off: [
            "Recommendations come from people you follow and people who felt the way you did about the same films.",
            "No language model reads your diary, your notes or your conversations.",
            "No assistant can be connected to your account.",
        ]
        case .on: [
            "Ask why a film reached you and get a plain answer built from responses you could already read.",
            "Connect your own assistant to your Moodie, with your permission and nobody else’s private writing.",
            "AI never posts, follows, recommends or replies in your name.",
        ]
        }
    }
    var footnote: String? {
        self == .on ? "These features arrive in a later release. Your choice is saved now and applies from the moment they do." : nil
    }
}

struct AIModeOption: View {
    let mode: AIMode
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: MoodieTokens.Space.s3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(mode.numeral).font(.system(.callout, design: .serif)).italic().foregroundStyle(MoodieTokens.Palette.inkMuted)
                    Spacer()
                    Image(systemName: selected ? "largecircle.fill.circle" : "circle").font(.title3)
                        .foregroundStyle(selected ? MoodieTokens.Palette.ink : MoodieTokens.Palette.ruleStrong)
                }
                Text(mode.title).font(.system(.title2, design: .serif)).foregroundStyle(MoodieTokens.Palette.ink)
                Text(mode.summary).font(.callout).foregroundStyle(MoodieTokens.Palette.inkSecondary)
                Divider().overlay(MoodieTokens.Palette.rule)
                ForEach(mode.points, id: \.self) { Text($0).font(.callout).foregroundStyle(MoodieTokens.Palette.ink) }
                if let footnote = mode.footnote { Text(footnote).font(.caption).foregroundStyle(MoodieTokens.Palette.inkMuted) }
            }
            .multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading).padding(MoodieTokens.Space.s5)
            .background(MoodieTokens.Palette.surface, in: RoundedRectangle(cornerRadius: MoodieTokens.Radius.surface))
            .overlay(RoundedRectangle(cornerRadius: MoodieTokens.Radius.surface)
                .strokeBorder(selected ? MoodieTokens.Palette.ink : MoodieTokens.Palette.ruleStrong, lineWidth: selected ? 2 : 1))
            .contentShape(RoundedRectangle(cornerRadius: MoodieTokens.Radius.surface))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine).accessibilityAddTraits(selected ? [.isSelected] : [])
        .accessibilityIdentifier("ai-mode-\(mode.rawValue)")
    }
}

/// First screen after joining: one decision, made before anything else is shown.
struct WelcomeChoiceView: View {
    @Environment(AppState.self) private var state
    @State private var choice: AIMode?
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoodieTokens.Space.s5) {
                HStack(spacing: MoodieTokens.Space.s3) { BrandMark(size: 26); Text("Moodie").font(.system(.title3, design: .serif)) }
                VStack(alignment: .leading, spacing: MoodieTokens.Space.s3) {
                    Text("BEFORE THE FIRST FILM").font(.caption2.weight(.semibold)).kerning(0.9).foregroundStyle(MoodieTokens.Palette.inkMuted)
                    Text("How should Moodie work for you?").font(.system(.largeTitle, design: .serif)).foregroundStyle(MoodieTokens.Palette.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("Moodie runs on people: what someone recommends to you and why, and what others felt about the films you have both seen. That is the same either way. The one thing to decide is whether AI is part of it.")
                        .font(.body).foregroundStyle(MoodieTokens.Palette.inkSecondary)
                }.padding(.top, MoodieTokens.Space.s5)
                ForEach(AIMode.allCases) { mode in
                    AIModeOption(mode: mode, selected: choice == mode) { choice = mode }.disabled(busy)
                }
                if let error { InlineError(message: error) }
                Text("You can change this at any time in Account.").font(.footnote).foregroundStyle(MoodieTokens.Palette.inkMuted)
            }.padding(.horizontal, MoodieTokens.Space.s5).padding(.vertical, MoodieTokens.Space.s5)
        }
        .safeAreaInset(edge: .bottom) {
            Button { Task { await save() } } label: {
                HStack { if busy { ProgressView().tint(MoodieTokens.Palette.canvas) }; Text(busy ? "Saving" : "Continue").fontWeight(.semibold) }
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .foregroundStyle(MoodieTokens.Palette.canvas)
            .background(MoodieTokens.Palette.ink.opacity(choice == nil ? 0.35 : 1), in: RoundedRectangle(cornerRadius: MoodieTokens.Radius.control))
            .disabled(choice == nil || busy).accessibilityIdentifier("ai-mode-continue")
            .padding(.horizontal, MoodieTokens.Space.s5).padding(.vertical, MoodieTokens.Space.s3)
            .background(MoodieTokens.Palette.canvas)
        }
        .moodieScreen()
    }
    private func save() async {
        guard let choice else { return }
        busy = true; error = nil; defer { busy = false }
        do { try await state.setAIMode(choice) } catch { self.error = error.localizedDescription }
    }
}

/// Account → AI. Changing the choice applies immediately on the server.
struct AIModeSettingsView: View {
    @Environment(AppState.self) private var state
    @State private var busy = false
    @State private var error: String?
    private var current: AIMode { AIMode(rawValue: state.user?.aiMode ?? "off") ?? .off }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoodieTokens.Space.s4) {
                Text("Moodie runs on people either way. This decides whether AI is part of your account. The change applies immediately.")
                    .font(.callout).foregroundStyle(MoodieTokens.Palette.inkSecondary)
                ForEach(AIMode.allCases) { mode in
                    AIModeOption(mode: mode, selected: current == mode) { Task { await set(mode) } }.disabled(busy)
                }
                if let error { InlineError(message: error) }
            }.padding(MoodieTokens.Space.s5)
        }.moodieScreen().navigationTitle("AI").navigationBarTitleDisplayMode(.inline)
    }
    private func set(_ mode: AIMode) async {
        guard mode != current else { return }
        busy = true; error = nil; defer { busy = false }
        do { try await state.setAIMode(mode) } catch { self.error = error.localizedDescription }
    }
}
