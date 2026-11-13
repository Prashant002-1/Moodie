# Native design working brief

> 2026-11-13: The shared direction and tokens now live in the root [DESIGN.md](../DESIGN.md) and `design/tokens.json`. Colours, spacing and radii here are generated from those tokens. Where this brief disagrees with the root document, the root document wins. The platform rules below (native navigation, Dynamic Type, system materials) still hold.

This is the implementation rationale for this app, not a new personal skill or permanent preference record.

The September 21–22 native refinement is complete locally and ready for the user's detailed review. See [design evolution](DESIGN_EVOLUTION.md) for research, four implemented passes, screenshot critiques, and scoped acceptance evidence. Release validation remains separate.

## General taste recovered for this task

Across the user's portfolio, Hermes, RoomDex, LegalOS, and Moodie feedback, recurring preferences are:

- Author the composition around the product's purpose. Use hierarchy, typography, meaningful imagery, and real state rather than generic decorative conventions.
- Keep the result mature, clean, and lean while retaining useful density, rich natural color, and purposeful interaction. Clean does not mean empty.
- Prefer ordinary, concrete copy. Do not narrate obvious behavior or put technical implementation details into everyday product flows. No em dashes.
- Preserve accepted work. Make corrections at the requested seam. Screenshots and new direct feedback outrank inherited taste assumptions.
- Build complete journeys with persistence and failure behavior, then verify the actual claim with proportionate effort. Report local build, signing, publication, and deployment separately.
- Use initiative within authorized scope. Avoid unnecessary dependencies and machinery. Respect an explicit review-before-publish boundary.

These are synthesized from recorded feedback. Individual palettes, shapes, textures, fonts, and motion systems remain project-specific. Hermes' square amber geometry and the portfolio's jade treatment are not universal rules. Texture has been welcomed in one composition and rejected in another.

## Native translation

The app keeps Moodie's warm mineral identity and edited density. SF system text handles controls and reading; the system serif gives film titles and major human moments character while scaling with Dynamic Type. Oxide is a selective action accent. Colors follow system light/dark appearance; compact light and maximum-text dark simulator captures were inspected. Physical-device and user visual acceptance remain separate. The product is not defined as a dark catalog.

Native tab bars, toolbars, sheets, menus, alerts, and the photo picker own their expected platform behaviors and current SDK materials. Glass is confined to system navigation and controls. Content uses a flat warm canvas, rules between responses, modest poster corners, and one distinct recommendation surface. There are no perpetual ambient effects or custom scrolling physics.

Four destinations: Home, Search, People, Diary. Activity lives off Home; Account lives off Diary. Add response is a toolbar action, never a navigation tab. The composer is a focused sheet with clear privacy and saving behavior.

A response keeps person, film, first-person note, and feelings together. A recommendation names its human source and shared film. Ratings, compatibility percentages, streaming controls, face analysis, and technical learning-system vocabulary do not appear.

Reading hierarchy: the compact person-and-film header establishes context, then the note uses the full column. Discovery cards expose the source response and shared-film comparison separately. Diary uses dates to distinguish individual viewings, with its recent summary and visibility filter subordinate to the history. After an attributed viewing, the save receipt prioritizes returning to the original person; additional discovery belongs after an unattributed response or back on Home.

Context changes the response layout. On a member page, the author is established by the profile; on a film page, the film is established by its header. Avoid repeating that identity on every response. Search supports quick saving and composing in place, while profiles keep the pair's recommendation history close to their shared films. Supporting catalog details should not delay the human response stream or fail it when a related-film request fails.

## Deliberately deferred

A new feeling vocabulary, changes to the existing website, push notifications, subscriptions, camera capture, elaborate animations, and external identity providers. The app currently uses the existing account system and server's seven feeling keys. The completed native refinement still needs the user's visual judgment and device/VoiceOver validation before release.

## Portable interaction rules

SwiftUI is the native presentation layer, not a shared web renderer. The [recommendation lifecycle](../docs/RECOMMENDATION_LIFECYCLE.md) and [OpenAPI contract](../docs/api/suggestions.openapi.json) remain the reusable behavior and data specification. No cross-platform UI dependency was added.

A later web implementation should preserve the same content order, source attribution, explicit reply consent, draft handling, and failure boundaries. Wrapping choices map to wrapping web layout; optional sections map to disclosure controls; local content tabs need keyboard navigation and selected-state semantics. Native colors have semantic names in the asset catalog. Typography follows the reader's size preference; artwork and decorative initials do not expand outside their frames. In narrow or large-text layouts, stack actions before reducing text size. Retain native control behavior on each platform rather than attempting pixel-identical navigation chrome.
