import SwiftUI

/// Intrinsic-width choices wrap without shrinking type or imposing a survey grid.
struct WrappingLayout: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(subviews, width: proposal.width ?? .infinity)
        return CGSize(width: proposal.width ?? result.width, height: result.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(subviews, width: bounds.width)
        for (index, point) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), anchor: .topLeading,
                proposal: ProposedViewSize(width: min(subviews[index].sizeThatFits(.unspecified).width, bounds.width), height: nil))
        }
    }
    private func arrange(_ subviews: Subviews, width: CGFloat) -> (positions: [CGPoint], width: CGFloat, height: CGFloat) {
        var points: [CGPoint] = [], x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, usedWidth: CGFloat = 0
        for view in subviews {
            let ideal = view.sizeThatFits(.unspecified)
            let size = view.sizeThatFits(ProposedViewSize(width: min(ideal.width, width), height: nil))
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + rowSpacing; rowHeight = 0 }
            points.append(CGPoint(x: x, y: y)); usedWidth = max(usedWidth, x + size.width)
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
        return (points, usedWidth, y + rowHeight)
    }
}

struct ReadingTabs: View {
    let choices: [String]
    @Binding var selection: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 26) {
                ForEach(choices, id: \.self) { choice in
                    Button { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { selection = choice } } label: {
                        Text(choice).font(.subheadline.weight(selection == choice ? .semibold : .regular))
                            .foregroundStyle(selection == choice ? MoodieTheme.ink : MoodieTheme.secondary)
                            .padding(.vertical, 13).frame(minHeight: 44).contentShape(Rectangle())
                            .overlay(alignment: .bottom) {
                                if selection == choice { Capsule().fill(MoodieTheme.ink).frame(height: 2) }
                            }
                    }.buttonStyle(.plain).accessibilityAddTraits(selection == choice ? .isSelected : [])
                }
            }
        }.scrollIndicators(.hidden).overlay(alignment: .bottom) { MoodieTheme.rule.frame(height: 0.5) }
    }
}

struct MoodieActionStyle: ButtonStyle {
    var primary = true
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.subheadline.weight(.semibold))
            .padding(.vertical, 8).frame(minHeight: 46).padding(.horizontal, 18)
            .foregroundStyle(primary ? MoodieTheme.canvas : MoodieTheme.ink)
            .background(primary ? MoodieTheme.ink : MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay { if !primary { RoundedRectangle(cornerRadius: 12).strokeBorder(MoodieTheme.rule, lineWidth: 0.7) } }
            .opacity(enabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)
    }
}

struct QuietLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased()).font(.caption2.weight(.semibold)).tracking(1.3).foregroundStyle(MoodieTheme.secondary)
    }
}

struct WritingSection<Content: View>: View {
    let title: String
    var hint: String? = nil
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.headline)
                Spacer(minLength: 8)
                if let hint { Text(hint).font(.caption).foregroundStyle(MoodieTheme.secondary) }
            }
            content()
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
