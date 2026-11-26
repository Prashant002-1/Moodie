---
name: Moodie
description: Films and shows, found through people.
direction: "Afterglow"
tokens: design/tokens.json
---

# Design system: Moodie

Revised 2026-11-26. Fourth direction. The first (warm paper and a red accent) was rejected as muddy. The second (neutral white, hairlines, no colour) was clean and had no identity. The third, The Lobby, borrowed its parts from Letterboxd (a hard bar, labels on hairlines, outlined poster grids, big-number counts, film-first review cards) and read as a clone of it, with every screen cut into sections. This one keeps the midnight canvas, the marquee yellow, people's colours and the three voices of type, and changes how a screen is put together.

## Direction: Afterglow

The light a film leaves on the people who watched it. A screen is one continuous surface in a dark room. Nothing on it is boxed off from the rest. What separates one thing from the next is space, type, a person's colour and a film's artwork, never a line or a frame.

Five things carry it.

1. **One surface.** No rules between sections, no outlined cards, no hard bars. The top bar is clear at the top of a page and frosts over only once the page moves under it. A page that opens with a film or a person starts under the bar and melts into the page below, with no edge.
2. **People are light.** Every person has one of seven colours from their username. It is their avatar and their name, and it falls on the page behind what they said or sent, like light from a lamp, fading out with no edge. A person's own page opens washed in their colour. A feed of friends is visibly a feed of *different people*.
3. **Films are atmosphere.** Artwork runs to the top of the window behind a film, a response, a recommendation and the top of Home, and fades into the page. Posters have no outline; one that opens something lifts a little under the pointer.
4. **Words first.** A response leads with what the person wrote. The film it is about follows as a small line: poster, title, feelings. A recommendation is a note: the person, the film and their reason, set straight on the page. Counts are a line of plain words ("2 responses, 1 follower"), never a scoreboard.
5. **Three voices of type.** A heavy serif for titles and for section headings, set in sentence case straight on the page. The same serif, regular, for what people wrote, and italic for what they said to you. A sans for everything the interface says. Capitals and letter-spacing are not used for navigation, tabs, headings or badges.

## Tokens

`design/tokens.json` is the single source for colour, type, spacing, radius and motion. `npm run tokens` generates `src/styles/tokens.css` (custom properties prefixed `--m-`), `ios/Moodie/Design/Tokens.swift` and the colorsets in the iOS asset catalog. Android will read the same file. `npm run tokens:check` runs in the web build. Never edit a generated file, and never put a raw colour, size or radius in a component.

## Colour

Dark is the identity and the default. Light is offered in Account, Appearance (Dark, Light, System).

| Role | Dark | Light | Use |
| --- | --- | --- | --- |
| canvas | `#0E1220` | `#FFFFFF` | The page. |
| band | `#151B2E` | `#F2F4FA` | The wash that opens a page and fades into the canvas. |
| surface | `#171D31` | `#FFFFFF` | Panels that sit over the page for a moment: a prompt, a list of people, comments. |
| surfaceRaised | `#1F2742` | `#F2F4FA` | Controls: fields, secondary buttons, chips, the current tab, menus, poster placeholders. |
| sunken | `#090C16` | `#EEF0F6` | The shadow under a menu and the browser's own bars. |
| ink | `#F3F5FB` | `#101530` | Text. |
| inkSecondary | `#B7C0D4` | `#434B66` | Reading text and supporting copy. |
| inkMuted | `#8591AB` | `#69728C` | Metadata and labels. Lowest contrast allowed for text. |
| rule / ruleStrong | `#222A43` / `#36405F` | `#E2E5EF` / `#C4CADA` | A control under the pointer, and the outline of a pressed toggle. Not used to divide content. |
| accent (marquee) | `#FFC53D` | `#FFC53D` | Primary button, current tab, selected chip, state marks. Always with `onAccent` `#17130A` on top. |
| accentInk | `#FFC53D` | `#8A5A00` | The accent used as text or a thin line. |
| error / success | `#FF8F85` / `#3DD68C` | `#B3261E` / `#0E8A4F` | Messages only. |

People: amber, green, sky, violet, teal, coral, lime (`--m-person-1` to `-7`, with darker values in light). Chosen by `personHue(username)`. Used only for people.

Rules:

- Gradients do two jobs only: they fade artwork and a page's opening wash into the canvas, and they are the light of a person's colour behind what that person said. Both fade to nothing with no visible edge. No other gradients, and no tinted panels.
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
| heading | 22 / 28 | 600 | Serif | Section headings, in sentence case. |
| label | 11 / 14 | 600, small capitals, +0.09em | Sans | Only a mark on a sample ("Example"). |

Small capitals are not used for navigation, tabs, section headings or badges. They read as a database.

## Layout

- Everything sits in one column, 1040px wide, on every page. Reading pages narrow to 720.
- A page opens with a wash when it has a subject: Home's greeting and notes over the film someone last thought of you for, a film or a response over its artwork, a person in their colour, the recommendations hub. The wash starts under the top bar and has no bottom edge.
- Sections are separated by space and a serif heading. There are no rules, and content is never placed in an outlined or filled box. Filled surfaces are for controls and for panels that sit over the page for a moment.
- Corners are soft: 8px on posters, 10px on controls, 18px on panels; buttons, chips and tabs are pills.
- Posters appear as walls where a set of films is the point (new from friends, search, a person's films). Beside words a poster is small: the words lead.

## Navigation: one identity on every platform

Home, Recommendations, People, Diary, with Search and Activity as icons, **Recommend** and **Log** as the two actions, and the person's own avatar. On a phone the same destinations sit in Moodie's own bottom bar with the add button in the middle. iOS and Android draw this bar themselves so the three clients look like one product.

The mark is two overlapping circles: two people and what they share. It is drawn in the marquee yellow and a person colour, with the overlap in ink.

## Motion

120 ms for state, 220 ms for most transitions, 420 ms for a change of scene, ease out. Transform and opacity only. A page rises into place as it opens; after that nothing moves on its own. Native scrolling. Reduced motion is respected.

## Words

The person using Moodie is the most intelligent part of the system. Warm and specific is welcome ("hiro thought of you"). Generic persuasion is not. A screen is never explained; nothing is said twice. Persuasion lives on the signed-out front page only.

## Do not

- Add ratings, stars, percentages, compatibility scores, charts of a person's feelings or a mood picker.
- Add colour that is not a person, artwork or the marquee.
- Divide content with a rule, or put it in an outlined or filled box.
- Set navigation, tabs, headings or badges in capitals.
- Lead a response with the film instead of the person's words.
- Present a recommendation or a response in a second way: use the shared components.
- Use small capitals for sentences.
- Reintroduce the name EmotionFlix.

## Known gaps

The iPhone app has not been moved to this system. Its colours and corner radii follow the shared tokens, but its layout, type and tab bar are still the earlier ones. The working brief for building a web screen is [design/WEB_UI_RULES.md](design/WEB_UI_RULES.md).
