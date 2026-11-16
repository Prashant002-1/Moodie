---
name: Moodie
description: Films and shows, found through people.
direction: "The Lobby"
tokens: design/tokens.json
---

# Design system: Moodie

Revised 2026-11-16. Third direction. The first (warm paper and a red accent) was rejected as muddy. The second (neutral white, hairlines, no colour) was clean and had no identity: "typography all over the place, no vision". This one starts from what the owner pointed to in Letterboxd: content held in a box, posters leading, reviews that read like a magazine, colour in the right places.

## Direction: The Lobby

The room outside the cinema after the film. Midnight walls, the warm light of the marquee, posters on every surface, and people talking about what they just saw. Moodie is that conversation.

Four things carry it.

1. **Midnight and marquee.** A deep blue-black canvas with a second, slightly lifted tone for the band that opens a page. One warm yellow, the marquee, for the action that matters and the thing that is current.
2. **People have colours.** Every person gets one of seven colours from their username. It is their avatar, their name wherever they speak, the edge of a note they sent. Films bring colour through artwork; people bring it through this. A feed of friends is therefore visibly a feed of *different people*.
3. **Three voices of type.** A heavy serif for titles. The same serif, regular, for what people wrote, and italic for what they said to you. A tight sans, and small capitals for section labels, for everything the interface says.
4. **A recommendation is a note.** The object the product exists for: a film, the person who thought of you, and their words, set like something you would want to keep. It appears on Home, in the hub, in Activity and in email, always the same.

## Tokens

`design/tokens.json` is the single source for colour, type, spacing, radius and motion. `npm run tokens` generates `src/styles/tokens.css` (custom properties prefixed `--m-`), `ios/Moodie/Design/Tokens.swift` and the colorsets in the iOS asset catalog. Android will read the same file. `npm run tokens:check` runs in the web build. Never edit a generated file, and never put a raw colour, size or radius in a component.

## Colour

Dark is the identity and the default. Light is offered in Account, Appearance (Dark, Light, System).

| Role | Dark | Light | Use |
| --- | --- | --- | --- |
| canvas | `#0E1220` | `#FFFFFF` | The page. |
| band | `#151B2E` | `#F2F4FA` | The strip that opens a page. |
| surface | `#171D31` | `#FFFFFF` | Notes, fields, panels. |
| surfaceRaised | `#1F2742` | `#F2F4FA` | Secondary buttons, menus, poster placeholders. |
| sunken | `#090C16` | `#EEF0F6` | The top bar and bottom bar. |
| ink | `#F3F5FB` | `#101530` | Text. |
| inkSecondary | `#B7C0D4` | `#434B66` | Reading text and supporting copy. |
| inkMuted | `#8591AB` | `#69728C` | Metadata and labels. Lowest contrast allowed for text. |
| rule / ruleStrong | `#222A43` / `#36405F` | `#E2E5EF` / `#C4CADA` | Hairlines and control borders. |
| accent (marquee) | `#FFC53D` | `#FFC53D` | Primary button, current tab, selected chip, state marks. Always with `onAccent` `#17130A` on top. |
| accentInk | `#FFC53D` | `#8A5A00` | The accent used as text or a thin line. |
| error / success | `#FF8F85` / `#3DD68C` | `#B3261E` / `#0E8A4F` | Messages only. |

People: amber, green, sky, violet, teal, coral, lime (`--m-person-1` to `-7`, with darker values in light). Chosen by `personHue(username)`. Used only for people.

Rules:

- One gradient exists: the scrim that keeps text readable over film artwork in a band. No decorative gradients, glows or tints.
- Feelings have no colours. Colour says *who*, never *what they felt*.
- The marquee yellow is never used for a person, and a person colour is never used for an action.

## Typography

- **Display and reading:** Fraunces (variable, with optical size). Heavy for titles, regular for notes, italic for words said to someone.
- **Interface:** Inter on the web and Android, the system face on iOS.

| Role | Size / line | Weight | Face | Use |
| --- | --- | --- | --- | --- |
| display | 44 / 48 | 600 | Serif | The front page headline. |
| title1 | 34 / 38 | 650 | Serif | Page and film titles. |
| title2 | 24 / 28 | 650 | Serif | A film in a response or list. |
| title3 | 19 / 24 | 650 | Serif | A film in a row. |
| quote | 20 / 30 | 400 italic | Serif | What someone said to you. |
| reading | 17 / 27 | 400 | Serif | What someone wrote about a film. |
| body | 15 / 22 | 400 | Sans | The interface. |
| callout | 14 / 20 | 400 | Sans | Secondary interface text. |
| caption | 13 / 18 | 400 | Sans | Metadata. |
| label | 11 / 14 | 600, small capitals, +0.09em | Sans | Section headings, navigation, tabs, state marks. |

Small capitals are for short labels only: a section heading, a tab, a navigation item, a badge. Never a sentence.

## Layout

- Everything sits in one box, 1040px wide, on every page. Reading pages narrow to 720.
- A page opens with a band when it has a subject: home's greeting and notes, a film over its artwork, a person, the recommendations hub.
- Films appear as posters whenever there is room: walls of six, a poster beside every response and note.
- Responses run in two columns on wide screens, like magazine columns.

## Navigation: one identity on every platform

Home, Recommendations, People, Diary, with Search and Activity as icons, **Recommend** and **Log** as the two actions, and the person's own avatar. On a phone the same destinations sit in Moodie's own bottom bar with the add button in the middle. iOS and Android draw this bar themselves so the three clients look like one product.

The mark is two overlapping circles: two people and what they share. It is drawn in the marquee yellow and a person colour, with the overlap in ink.

## Motion

120 ms for state, 220 ms for most transitions, 420 ms for a change of scene, ease out. Transform and opacity only. Nothing moves on its own. Native scrolling. Reduced motion is respected.

## Words

The person using Moodie is the most intelligent part of the system. Warm and specific is welcome ("hiro thought of you"). Generic persuasion is not. A screen is never explained; nothing is said twice. Persuasion lives on the signed-out front page only.

## Do not

- Add ratings, stars, percentages, compatibility scores, charts of a person's feelings or a mood picker.
- Add colour that is not a person, artwork or the marquee.
- Present a recommendation or a response in a second way: use the shared components.
- Use small capitals for sentences.
- Reintroduce the name EmotionFlix.

## Known gaps

The iPhone app has not been moved to this system. Its colours follow the shared tokens, but its layout, type and tab bar are still the earlier ones. The working brief for building a web screen is [design/WEB_UI_RULES.md](design/WEB_UI_RULES.md).
