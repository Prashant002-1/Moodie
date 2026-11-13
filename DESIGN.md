---
name: Moodie
description: Films and shows, found through people.
direction: "Gallery and screening room"
tokens: design/tokens.json
---

# Design system: Moodie

Revised 2026-11-13 (second revision the same day, after the paper-and-red palette was rejected as muddy and the type as too loose). The reasons are in [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md), principles 6 and 11.

## Direction: a gallery wall and a screening room

Two neutral rooms and nothing else. In light, a white wall with black type. In dark, a near-black room. The only colour on screen is film artwork.

The references are Letterboxd and Beli for clarity, MUBI and film-institution catalogues for restraint. What they share: you never notice the interface.

1. **Neutral, not tinted.** White and near-black with grey rules. No beige, no cream, no warm or cool cast, no gradients, no glows, no grain.
2. **Ink is the emphasis.** Selection, the primary action and the current tab are ink on canvas. There is no brand colour doing that job.
3. **Titles are serif, everything else is quiet.** A film's title is the only thing set in the display face. The rest is one tight sans.
4. **Lists, not cards.** Content sits on the canvas in rows separated by hairlines. No boxes inside boxes, no shadows.
5. **Nothing is said twice.** One control per action, one label per thing.

## Tokens

`design/tokens.json` is the single source for colour, type, spacing, radius and motion. `npm run tokens` generates:

- `src/styles/tokens.css`: CSS custom properties prefixed `--m-`.
- `ios/Moodie/Design/Tokens.swift` and the semantic colorsets in the iOS asset catalog.

Android will read the same file. `npm run tokens:check` runs in the web build and fails if a generated file is stale. Never edit a generated file. Never introduce a raw colour, size or radius in a component.

## Colour

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| canvas | `#FFFFFF` | `#0B0B0C` | The page. |
| surface | `#FFFFFF` | `#141415` | Fields and raised sheets. |
| sunken | `#F5F5F3` | `#060607` | Wells, avatar and poster placeholders, hover. |
| ink | `#0E0E0E` | `#F3F2EF` | Text, primary buttons, selection. |
| inkSecondary | `#454545` | `#B9B8B4` | Supporting copy. |
| inkMuted | `#6E6E6E` | `#8B8A87` | Metadata. Lowest contrast allowed for text. |
| rule / ruleStrong | `#E8E8E5` / `#CFCFCB` | `#242425` / `#3B3B3D` | Hairlines and control borders. |
| accent | `#2B3FD0` | `#96A2FF` | The keyboard focus ring. Reserved, otherwise unused. |
| laurel | `#8F7437` | `#C9A961` | Reserved for honours. Unused today. |
| error / success | `#B3261E` / `#1F6B4F` | `#F08C86` / `#7FBFA9` | Messages only. |

Rules:

- The web follows the system light or dark setting. A person can fix it in Account, Appearance.
- No decorative colour. A gradient is allowed only as a scrim under text on artwork.
- Feelings have no colour. The per-feeling hues in the token file remain only because the iPhone app still reads them; they go when it is redesigned.

## Typography

- **Display:** Newsreader. Film and show titles and page headings only.
- **Interface and reading:** Inter on the web and Android, the system face (SF) on iOS. They are close enough to read as one identity.
- **Mono:** system monospace, where digits must align.

| Role | Size / line | Tracking | Face |
| --- | --- | --- | --- |
| display | 44 / 48 | -0.02em | Display |
| title1 | 32 / 36 | -0.015em | Display |
| title2 | 24 / 28 | -0.01em | Display |
| title3 | 19 / 24 | -0.005em | Display |
| body | 16 / 24 | -0.011em | Sans |
| callout | 14 / 20 | -0.006em | Sans |
| caption | 13 / 18 | 0 | Sans |
| label | 12 / 16, medium | 0 | Sans |

No uppercase labels and no wide letter-spacing anywhere. Section headings are 14px semibold sans, not small capitals.

## Space, shape and depth

- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius: posters 4, controls 8, surfaces 12, pills for chips and avatars only.
- No shadows. Separation is a hairline or space.

## Navigation: one identity on every platform

Five destinations in a fixed order: **Home, Watchlist, add a response, Search, Diary.** Activity (a bell) and Account (the person's initial) sit at the top right.

- Wide screens: a top bar with the wordmark, the destinations as text, and the add button.
- Phones: the same destinations as a custom bottom bar with the add button in the middle.
- iOS and Android use this bar, drawn by the app, not the platform's default tab bar, so the three clients look like one product. (The iPhone app still uses the system tab bar; it changes when the phone is redesigned.)

The mark is the word "Moodie" set in the display face. There is no pictorial logo yet; the old film-strip mark is retired from the interface.

## Motion

- Durations: 120 ms for state changes, 220 ms for most transitions, 420 ms for a change of scene. Ease out.
- Animate transform and opacity only. Nothing moves on its own.
- Native scrolling. No scroll hijacking.
- `prefers-reduced-motion` removes non-essential movement.

## Components

All in `src/styles/app.css`. The working brief for building a screen is [design/WEB_UI_RULES.md](design/WEB_UI_RULES.md).

- **Response:** person, film title, feelings as words, note, verdict and what stood out, then like, comment and add to watchlist. One component (`ResponseCard`).
- **Recommendation:** leads with the person and their reason. The shared film and both people's words are the evidence. No score.
- **Feelings:** words in order, strongest first, in ink. See [docs/FEELINGS.md](docs/FEELINGS.md).
- **Chips** for choosing words; selected is ink. **Tabs** are text with a hairline. **Options** (visibility, appearance, AI) are bordered radio blocks; selected is an ink border.
- **Buttons:** primary is ink, secondary is outlined, quiet is text. One primary action per screen at most.
- **Forms:** label above field, 44px controls, one column.

## Words

The person using Moodie is the most intelligent part of the system.

- The product never sells itself from inside. No slogans, no taglines, no "start your journey".
- A screen is not explained. A heading, labels and content are enough.
- Empty states are one factual sentence and at most one action.
- Plain nouns and verbs: Watchlist, Diary, Follow, Reply, Save, Send.
- Errors and confirmations that protect data or privacy are kept and written plainly.

## Do not

- Add gradients, glows, tints, grain, shadows or coloured decoration.
- Add ratings, stars, percentages, compatibility scores, charts of a person's feelings or popularity ranking.
- Add a mood picker of any kind.
- Use icons as decoration, or two controls for one action.
- Use uppercase tracked labels.
- Reintroduce the name EmotionFlix.

## Known gaps

The iPhone app has not been moved to this system: it still uses the system tab bar, the old feeling sliders and colours. There is no pictorial brand mark or app icon. The signed-out front page is a single statement and two buttons; a real product page is separate work. Tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
