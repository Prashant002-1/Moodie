import SwiftUI
import MoodieCore

/// Content stays material and quiet. Native navigation owns glass, motion, and safe areas.
enum MoodieTheme {
    static let canvas = Color("Canvas")
    static let surface = Color("Surface")
    static let ink = Color("Ink")
    static let accent = Color("AccentColor")
    static let secondary = Color("SecondaryInk")
    static let rule = Color("SecondaryInk").opacity(0.18)
    static func color(_ feeling: Feeling) -> Color {
        switch feeling {
        case .neutral: Color("FeelingNeutral")
        case .happy: Color("FeelingHappy")
        case .sad: Color("FeelingSad")
        case .angry: Color("FeelingAngry")
        case .fearful: Color("FeelingFearful")
        case .disgusted: Color("FeelingDisgusted")
        case .surprised: Color("FeelingSurprised")
        }
    }
}

struct BrandMark: View {
    var size: CGFloat = 32
    var body: some View {
        Image("BrandMark").resizable().scaledToFit().frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}
struct Avatar: View {
    let name: String
    var size: CGFloat = 34
    var body: some View {
        let tones: [Color] = [MoodieTheme.accent, MoodieTheme.color(.sad), MoodieTheme.color(.surprised), MoodieTheme.color(.fearful)]
        let index = name.unicodeScalars.reduce(0) { ($0 + Int($1.value)) % tones.count }
        Text(String(name.prefix(1)).uppercased()).font(.system(size: size * 0.42, weight: .medium))
            .frame(width: size, height: size).foregroundStyle(MoodieTheme.ink)
            .background(tones[index].opacity(0.13), in: Circle())
            .overlay(Circle().strokeBorder(tones[index].opacity(0.12), lineWidth: 0.6)).accessibilityHidden(true)
    }
}
struct Poster: View {
    let path: String?
    var width: CGFloat = 76
    var title: String? = nil
    var body: some View {
        AsyncImage(url: Artwork.url(path: path)) { image in image.resizable().scaledToFill() }
        placeholder: {
            Rectangle().fill(MoodieTheme.ink.opacity(0.07)).overlay(alignment: .bottomLeading) {
                if let title { Text(title).font(.system(size: min(14, width * 0.18), design: .serif)).lineLimit(4).padding(8).foregroundStyle(MoodieTheme.secondary) }
            }
        }
        .frame(width: width, height: width * 1.5).clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(MoodieTheme.ink.opacity(0.1), lineWidth: 0.6))
        .shadow(color: .black.opacity(0.09), radius: 3, x: 0, y: 2)
        .accessibilityHidden(true)
    }
}
struct FeelingTrace: View {
    let feelings: Feelings
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { labels }
            VStack(alignment: .leading, spacing: 8) { labels }
        }
    }
    @ViewBuilder private var labels: some View {
        ForEach(Array(feelings.strongest.prefix(3))) { feeling in
            HStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 2).fill(MoodieTheme.color(feeling)).frame(width: 4, height: 12)
                Text(feeling.title).font(.caption.weight(.medium)).foregroundStyle(MoodieTheme.secondary)
            }.accessibilityElement(children: .ignore)
                .accessibilityLabel("\(feeling.title), \(Int(feelings[feeling] * 100)) percent intensity")
        }
    }
}
struct InlineError: View {
    let message: String
    var retry: (() -> Void)?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(message, systemImage: "exclamationmark.circle").font(.callout)
            if let retry { Button("Try again", action: retry).buttonStyle(.bordered) }
        }.padding().frame(maxWidth: .infinity, alignment: .leading)
            .background(MoodieTheme.surface, in: RoundedRectangle(cornerRadius: 12))
            .accessibilityElement(children: .contain)
    }
}
struct FilmRow: View {
    let film: Film
    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            Poster(path: film.posterPath, width: 58, title: film.title)
            VStack(alignment: .leading, spacing: 5) {
                Text(film.title).font(.system(.title3, design: .serif)).foregroundStyle(MoodieTheme.ink)
                if !film.year.isEmpty { Text(film.year).font(.subheadline).foregroundStyle(MoodieTheme.secondary) }
                if let runtime = film.runtime, runtime > 0 { Text("\(runtime) min").font(.caption).foregroundStyle(MoodieTheme.secondary) }
            }
            Spacer(minLength: 0)
        }.padding(.vertical, 7).contentShape(Rectangle())
    }
}
struct AddResponseButton: View {
    @Environment(AppState.self) private var state
    var body: some View {
        Button("Add response", systemImage: "square.and.pencil") { state.composer = ComposerRequest() }
            .labelStyle(.iconOnly).accessibilityIdentifier("add-response")
    }
}
struct PageHeading: View {
    let title: String
    var subtitle: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(.largeTitle, design: .serif)).foregroundStyle(MoodieTheme.ink)
            if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(MoodieTheme.secondary) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12)
    }
}
extension View {
    func moodieScreen() -> some View { self.background(MoodieTheme.canvas).foregroundStyle(MoodieTheme.ink) }
}
