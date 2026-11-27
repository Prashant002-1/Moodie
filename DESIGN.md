---
name: Moodie
description: Films and shows, found through people.
direction: "Screening Room"
tokens: design/tokens.json
---

# Design system: Moodie

Revised 2026-11-26. Fifth direction. The first (warm paper and a red accent) was rejected as muddy. The second (neutral white, hairlines, no colour) was clean and had no identity. The third, The Lobby, borrowed its parts from Letterboxd and read as a clone of it, with every screen cut into sections. The fourth, Afterglow, removed the sections but lit everything with gradients, glows, a bright yellow and seven neon person colours, and was rejected as too bright and not solid. This one keeps the fourth's structure (one surface, words first, three voices of type) and makes it flat and quiet.

## Direction: Screening Room

A dark room with the lights down. The interface is one tone of ink on one tone of canvas. The only colour on a screen comes from film posters and from people's avatars.

Six things carry it.

1. **One surface.** No rules between sections, no outlined cards, no hard bars. The top bar is the page's own colour. What separates one thing from the next is space and type, never a line or a frame.
2. **Flat.** No gradients, no glows, no washes, no translucent or blurred layers, no artwork faded behind text. Every fill is one solid tone.
3. **Ink is the accent.** The primary button, a selected chip, a state mark and the focus ring are the ink colour on the canvas (bone on near-black in dark, near-black on paper in light). There is no brand hue in the interface.
4. **People are a disc of colour.** Every person has one of seven muted tones from their username. It fills their avatar and nothing else: names are ink. The seven are one family, the same lightness and strength.
5. **Words first, in one column.** A response leads with what the person wrote; the film follows as a small line: poster, title, feelings. Screens that are a stream of words (Home, Recommendations, a recommendation, a response, Diary, Activity) are one reading column, 720px wide, with one left edge from top to bottom. Counts are a line of plain words, never a scoreboard.
6. **Three voices of type.** Cormorant, semibold, for titles and section headings, in sentence case. The same serif, medium, for what people wrote, and italic for what they said to you. Jost, a geometric sans, for everything the interface says. Capitals and letter-spacing are not used for navigation, tabs, headings or badges.

## Tokens

`design/tokens.json` is the single source for colour, type, spacing, radius and motion. `npm run tokens` generates `src/styles/tokens.css` (custom properties prefixed `--m-`), `ios/Moodie/Design/Tokens.swift` and the colorsets in the iOS asset catalog. Android will read the same file. `npm run tokens:check` runs in the web build. Never edit a generated file, and never put a raw colour, size or radius in a component.

## Colour

Dark is the identity and the default. Light is offered in Account, Appearance (Dark, Light, System).

| Role | Dark | Light | Use |
| --- | --- | --- | --- |
| canvas | `#111110` | `#FAF9F7` | The page and the top bar. |
| surface | `#1A1918` | `#F2F0EC` | Panels that sit over the page for a moment (a prompt, a list of people, comments) and the phone's bottom bar. |
| surfaceRaised | `#252422` | `#EAE7E2` | Controls: fields, secondary buttons, chips, the current tab, menus, poster placeholders. |
| sunken | `#0A0A09` | `#E3E0DA` | The shadow under a menu and the browser's own bars. |
| ink | `#F2EFE9` | `#161514` | Text. |
| inkSecondary | `#BEBAB2` | `#4A4844` | Reading text and supporting copy. |
| inkMuted | `#8E8A83` | `#6F6C66` | Metadata and labels. Lowest contrast allowed for text. |
| rule / ruleStrong | `#2B2A28` / `#3D3C39` | `#E3E0DA` / `#CDC9C1` | A control under the pointer, and the outline of a pressed toggle. Not used to divide content. |
| accent | `#F2EFE9` | `#161514` | The ink colour used as a fill: primary button, selected chip, state marks. Always with `onAccent` on top. |
| error / success | `#F0958B` / `#7FC79B` | `#B3261E` / `#1E7A4B` | Messages only. |

`band` equals `canvas` and `accentInk` equals `ink`; both tokens are kept so the native clients keep building.

People: clay, sand, sage, teal, sky, lilac, rose (`--m-person-1` to `-7`, with darker values in light). Chosen by `personHue(username)`. Used only to fill an avatar, and in the brand mark.

Rules:

- No gradients anywhere, including behind artwork and as masks.
- No left or side rule on a quote, a note or a panel.
- Feelings have no colours. Colour says *who*, never *what they felt*.
- A link or a title under the pointer is underlined; it does not change colour.

## Typography

- **Titles and people's words:** Cormorant (variable, 300 to 700). A Garamond drawn for display: tall, sharp and calm, like a film's title card. Semibold for titles and headings, medium for notes, medium italic for words said to someone. It has a small x-height, so it is set a step larger than a text face would be.
- **Interface:** Jost (variable). A geometric sans in the Futura tradition. Regular for text, medium and semibold for controls. iOS uses the system face.

| Role | Size / line | Weight | Face | Use |
| --- | --- | --- | --- | --- |
| display | 54 / 56 | 600 | Serif | The front page headline, a film's title on its own page. |
| title1 | 40 / 42 | 600 | Serif | Page titles, a film in a full-size note. |
| title2 | 28 / 31 | 600 | Serif | A film in a compact note. |
| title3 | 22 / 26 | 600 | Serif | A film in a row or under a response. |
| heading | 26 / 31 | 600 | Serif | Section headings, in sentence case. |
| quote | 23 / 32 | 500 italic | Serif | What someone said to you. |
| reading | 20 / 29 | 500 | Serif | What someone wrote about a film. |
| body | 16 / 23 | 400 | Sans | The interface. |
| callout | 15 / 21 | 400 | Sans | Secondary interface text. |
| caption | 14 / 19 | 400 | Sans | Metadata. |
| label | 12 / 15 | 600, small capitals, +0.08em | Sans | Only a mark on a sample ("Example"). |

A year beside a title is set in the sans at 0.6 of the title's size. Small capitals are not used for navigation, tabs, section headings or badges.

## Layout

- The bar and the wide pages (a film, a person, People, Search, the composer) sit in a 1040px box. Streams of words sit in one 720px reading column, centred.
- A page that has a subject opens with it: a film's poster, title, synopsis and actions; a person's avatar, name and counts. It is the same surface as the rest of the page.
- Home is one column in one order: the view tabs, the greeting, reminders, recommendations, new from friends, films through people, recent responses.
- Sections are separated by space and a serif heading. There are no rules, and content is never placed in an outlined or filled box. Filled surfaces are for controls and for panels that sit over the page for a moment.
- Corners are soft: 8px on posters, 10px on controls, 18px on panels; buttons, chips and tabs are pills.
- Posters appear as walls where a set of films is the point (new from friends, search, a person's films). Beside words a poster is small: the words lead.

## Navigation: one identity on every platform

Home, Recommendations, People, Diary, with Search and Activity as icons, **Recommend** and **Log** as the two actions, and the person's own avatar. On a phone the same destinations sit in Moodie's own bottom bar with the add button in the middle. iOS and Android draw this bar themselves so the three clients look like one product.

The mark is two overlapping circles: two people and what they share. It is drawn in two person tones (clay and sky), with the overlap in ink.

## Motion

120 ms for state, 220 ms for most transitions, 420 ms for a change of scene, ease out. Transform and opacity only. A page rises into place as it opens; after that nothing moves on its own. Native scrolling. Reduced motion is respected.

## Words

The person using Moodie is the most intelligent part of the system. Warm and specific is welcome ("hiro thought of you"). Generic persuasion is not. A screen is never explained; nothing is said twice. Persuasion lives on the signed-out front page only.

## Drawn marks and small answers

Four ink drawings exist: a ticket, a folded note in flight, two seats and a reel. One stroke weight, no fill, no colour; each draws itself once (the one exception to "transform and opacity only"). They appear only in quiet moments (an empty state, "Sent to", "In your diary"), never beside content.

A verdict can be pressed onto a poster like a stamp: on a newcomer's first answers, and on a recommendation once the person it was for has replied. A control answers a tap with a short bounce. Nothing loops and nothing moves unasked.

## Do not

- Add ratings, stars, percentages, compatibility scores, charts of a person's feelings or a mood picker.
- Add colour that is not a poster or an avatar.
- Add a gradient, a glow, a blur or a tinted wash.
- Put a coloured rule down the side of a quote or a panel.
- Divide content with a rule, or put it in an outlined or filled box.
- Set navigation, tabs, headings or badges in capitals.
- Lead a response with the film instead of the person's words.
- Present a recommendation or a response in a second way: use the shared components.
- Use small capitals for sentences.
- Reintroduce the name EmotionFlix.

## Known gaps

The iPhone app has not been moved to this system. Its colours and corner radii follow the shared tokens (so its accent is now the ink colour), but its layout, type and tab bar are still the earlier ones and it has not been built or checked against this palette. The working brief for building a web screen is [design/WEB_UI_RULES.md](design/WEB_UI_RULES.md).
