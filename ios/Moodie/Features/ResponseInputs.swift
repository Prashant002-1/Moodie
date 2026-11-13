import SwiftUI
import MoodieCore

struct EnjoymentPicker: View {
    @Binding var value: Enjoyment?
    var body: some View {
        WrappingLayout {
            ForEach(Enjoyment.allCases) { item in
                ChoiceButton(title: item.title, selected: value == item) { value = value == item ? nil : item }
                    .accessibilityIdentifier("enjoyment-\(item.rawValue)")
            }
        }.sensoryFeedback(.selection, trigger: value)
    }
}
struct HighlightPicker: View {
    @Binding var values: [ResponseHighlight]
    var body: some View {
        WrappingLayout {
            ForEach(ResponseHighlight.allCases) { item in
                ChoiceButton(title: item.title, selected: values.contains(item)) {
                    if values.contains(item) { values.removeAll { $0 == item } } else { values.append(item) }
                }.accessibilityIdentifier("highlight-\(item.rawValue)")
            }
        }.sensoryFeedback(.selection, trigger: values)
    }
}
struct ChoiceButton: View {
    let title: String
    let selected: Bool
    var color: Color = MoodieTheme.ink
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title).fixedSize(horizontal: false, vertical: true)
                Image(systemName: "checkmark").font(.caption2.weight(.bold)).foregroundStyle(color).opacity(selected ? 1 : 0).accessibilityHidden(true)
            }.font(.subheadline.weight(selected ? .medium : .regular)).padding(.vertical, 6).frame(minHeight: 44)
                .padding(.horizontal, 13)
                .foregroundStyle(selected ? MoodieTheme.ink : MoodieTheme.secondary)
                .background(selected ? color.opacity(0.10) : .clear, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(selected ? color.opacity(0.4) : MoodieTheme.rule, lineWidth: 0.8))
        }.buttonStyle(.plain).accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct FeelingPicker: View {
    @Binding var feelings: Feelings
    @State private var fineTuning = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            WrappingLayout {
                ForEach(Feeling.allCases) { feeling in
                    ChoiceButton(title: feeling.title, selected: feelings[feeling] > 0, color: MoodieTheme.color(feeling)) {
                        feelings[feeling] = feelings[feeling] > 0 ? 0 : 0.5
                    }.accessibilityIdentifier("feeling-\(feeling.rawValue)")
                }
            }
            if feelings.hasSelection {
                DisclosureGroup("Adjust intensity", isExpanded: $fineTuning) {
                    ForEach(Feeling.allCases.filter { feelings[$0] > 0 }) { feeling in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(feeling.title).font(.subheadline)
                            Slider(value: Binding(get: { feelings[feeling] }, set: { feelings[feeling] = $0 }), in: 0.05...1, step: 0.05) {
                                Text("\(feeling.title) intensity")
                            } minimumValueLabel: { Text("A little").font(.caption2) }
                              maximumValueLabel: { Text("A lot").font(.caption2) }
                            .tint(MoodieTheme.color(feeling))
                            .accessibilityValue("\(Int(feelings[feeling] * 100)) percent")
                        }.padding(.top, 10)
                    }
                }.font(.subheadline)
            }
        }.sensoryFeedback(.selection, trigger: feelings.hasSelection)
    }
}

struct ResponseDetails: View {
    let enjoyment: Enjoyment?
    let highlights: [ResponseHighlight]
    var body: some View {
        if enjoyment != nil || !highlights.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                if let enjoyment { Text(enjoyment.title).font(.subheadline.weight(.medium)) }
                if !highlights.isEmpty { Text(highlights.map(\.title).joined(separator: " · ")).font(.caption).foregroundStyle(MoodieTheme.secondary) }
            }
        }
    }
}
