---
name: Moodie
description: Social film discovery through people and their responses.
direction: "The Programme"
tokens: design/tokens.json
---

# Design system: Moodie

Revised 2026-11-13. This replaces the earlier "Living Afterimage" direction. The reasons are in [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md), principle 6.

## Creative direction: The Programme

Moodie should feel like walking into a cinémathèque: a festival programme, a museum wall, an archive of film. The references are MUBI, the catalogues of film institutions, Cannes, and the shops that used to be lined with discs.

Those places look premium for one reason: the work is the decoration. Nothing competes with the films.

Three rules carry the direction.

1. **The canvas is still.** One flat, warm paper surface. No ambient colour, no gradient fields, no glows, no scanlines, no grain. Colour on screen comes from film artwork and, sparingly, from one accent.
2. **Typography is the ornament.** Hierarchy comes from a serif display face against a quiet grotesque, generous space and thin rules. Not from boxes, shadows or tints.
3. **Films are hung, not piled.** Artwork sits on the canvas like a work on a wall: square corners, a caption, room around it.

## Tokens

`design/tokens.json` is the single source for colour, type, spacing, radius and motion. `npm run tokens` generates:

- `src/styles/tokens.css`: CSS custom properties prefixed `--m-`.
- `ios/Moodie/Design/Tokens.swift` and the semantic colorsets in the iOS asset catalog.

Android will read the same file. `npm run tokens:check` runs in the web build and fails if a generated file is stale. Never edit a generated file, and never introduce a raw colour, size or radius in a component: add or reuse a token.

Older stylesheets still use legacy names such as `--color-chalk` and `--color-oxide`. They now resolve to tokens in `src/index.css`. New rules use `--m-*` directly, and legacy names are removed as each screen is revisited.

## Colour

| Role | Light | Dark (screening room) | Use |
| --- | --- | --- | --- |
| canvas | `#F4F1EA` | `#0F1214` | The page. |
| surface | `#FBF9F5` | `#181C1F` | Fields, cards, sheets. |
| sunken | `#EAE6DD` | `#0A0C0E` | Wells and quiet secondary areas. |
| ink | `#161D21` | `#EFEBE2` | Text, primary buttons, selection. |
| inkSecondary | `#465056` | `#B4B8B6` | Supporting copy. |
| inkMuted | `#626B70` | `#8C9294` | Metadata and labels. Lowest contrast allowed for text. |
| rule / ruleStrong | `#DAD6CD` / `#B4B0A7` | `#2A2F33` / `#454B50` | Hairlines and control borders. |
| accent | `#A63B2C` | `#E0705F` | One deliberate mark per screen: an active state, a single call to action. |
| laurel | `#8F7437` | `#C9A961` | Rare. Reserved for honours and programme marks. |
| inverse / onInverse | `#161D21` / `#F4F1EA` | reversed | A dark frame on the light canvas, used for one featured item. |

Rules:

- No gradients as decoration, in any hue. A gradient is allowed only as a scrim that keeps text legible over artwork.
- The accent is a deep red, not a pink or coral. It never fills large areas and never tints a background.
- Shadows are neutral ink at low opacity. No coloured or hard-offset shadows.
- The dark theme is defined in tokens. iOS follows the system appearance. The web uses light until each screen has been checked in dark.

## Typography

- **Display:** Newsreader. Film and show titles, page headings, the rare human moment. Titles may be set in italic where they appear inside a sentence.
- **Interface and reading:** Instrument Sans on the web, the system face (SF) on iOS. Controls, notes, metadata.
- **Mono:** the system monospace, for catalogue numbers and dates where alignment matters.

| Role | Size / line | Face |
| --- | --- | --- |
| display | 56 / 60 | Display |
| title1 | 40 / 44 | Display |
| title2 | 30 / 36 | Display |
| title3 | 22 / 28 | Display |
| body | 17 / 26 | Sans |
| callout | 15 / 22 | Sans |
| caption | 13 / 18 | Sans |
| label | 11 / 14, uppercase, tracked 0.08em, semibold | Sans |

iOS maps each role to a Dynamic Type style so text follows the reader's size setting. Uppercase labels are for short functional categories only.

## Space, shape and depth

- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64, 96. Prefer more space to another divider.
- Radius: posters 2, controls 6, surfaces 10. Corners are close to square. No pills except true toggles.
- Depth is rare. Most surfaces are flat with a hairline. One soft neutral shadow may lift artwork.
- Avoid repeated floating cards, glass tiles and oversized radii.

## Motion

Motion is smooth and has a reason: it shows where something came from or went.

- Durations: 120 ms for state changes, 220 ms for most transitions, 420 ms for a change of scene. Ease out.
- Animate transform and opacity only.
- Nothing moves on its own. No ambient drift, no perpetual loops in the signed-in product.
- `prefers-reduced-motion` and Reduce Motion remove non-essential movement.

## Feelings

Feelings are words a person chose. Colour is a secondary cue and never stands alone: every feeling is shown with its label and has an accessible name. Never present a feeling as a percentage or a score. The seven keys and their hues in `design/tokens.json` are a scaffold until the vocabulary is redesigned (see the roadmap).

## Components and patterns

- **Response:** person, title, first-person note and feelings stay together. Never a media-first social card.
- **Recommendation:** leads with the person and their reason. The shared film and both people's responses can be compared. No score.
- **Choice cards** (see the onboarding AI choice): a numeral, a serif title, one-line summary, a ruled list. Selection is an ink border, not a colour fill.
- **Primary action:** ink on canvas. The accent is for the one action that matters most on a screen, if any.
- **Navigation, web:** a slim icon rail when signed in, with no header. A plain header with Moodie, Sign in and Sign up when signed out.
- **Navigation, iOS:** system tab bar with Home, Search, People, Diary. Activity lives off Home, Account off Diary. Add a response is a sheet.
- **Onboarding:** one decision per screen, with no navigation competing with it.

## Copy

Use film, show, response, feelings, note, person, diary, follow, recommend literally. Describe what happens before explaining why. Keep the person and the source visible in every recommendation.

Avoid invented feature names, marketing language, technical architecture in the interface, and any claim that Moodie understands, detects or diagnoses a person.

## Do not

- Add gradient fields, glows, fog, scanlines, grain or coloured light of any kind.
- Add ratings, stars, percentages, compatibility scores or popularity-first ranking.
- Build a streaming-style catalog wall.
- Use film strips, clapperboards, notebooks or other props as decoration.
- Use a coloured left border as a mark on a box or quote.
- Hide a person's note, feelings or the source of a recommendation behind hover.
- Reintroduce the name EmotionFlix or anything ending in "flix".

## Known gaps

The landing page was composed around the removed ambient field and needs a new centre. Many signed-in web screens still carry legacy values, and the iOS screens are close to system defaults. The app icon and brand mark are placeholders. All of this is tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
