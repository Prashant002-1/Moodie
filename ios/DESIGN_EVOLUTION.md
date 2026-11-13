# Native experience refinement

Status: local refinement complete, ready for the user's detailed review. Started September 21, 2026; completed September 22 after four implementation and critique passes. The goal is a cohesive, distinctive social film product with mature interaction and visual hierarchy. Completion here means the scoped native refinement and verification below, not market validation or release approval.

## Evidence and interpretation

The first audit inspected the saved native screenshots and the live implementation. The repeated segmented pickers, large form groups, checkbox grids, equal-weight headings, and long stacks of explanations made the interface feel like a feature inventory. Personal recommendations were readable, but their people and reasons had little visual distinction from ordinary catalog rows. Composing a reply required navigating several form sections before reaching the words.

Reference research used published product screens, not an installed-account walkthrough. These observations are design interpretations, not claims about commercial success:

| Reference | Observed principle | Translation |
| --- | --- | --- |
| [Sequel](https://www.getsequel.app/) | Published wishlist and quick-entry screens use recognizable artwork, tight metadata, and actions at the point of choosing. The artwork and interface have distinct jobs. | Make title, year, person, and action readable at different levels. Keep familiar native navigation while authoring content layout. |
| [Sofa](https://www.sofahq.com/) | Tracking screenshots distinguish the collection, the current item, and the next action. Detail appears in context rather than occupying every row. | Use progressive disclosure for optional detail and keep the next meaningful action nearby. Do not import its tracking dashboards or customization machinery. |
| [Beli's published feed](https://beliapp.com/) | A compact person/action/place sentence precedes the specific remembered detail. Personal notes make the place meaningful. | Give a recommendation a visible author and an uninterrupted note. Preserve deliberate sends versus discoveries. Do not import restaurant scores or ranking. |

## Working direction

Retain Moodie's mineral canvas and oxide accent. Give film titles a restrained serif voice; keep people, writing, and controls in readable system text. Use rules, spacing, and intrinsic sizing before containers. A selected feeling should look like an expressive choice, not an incomplete checklist. Native sheets and navigation remain native; the content inside them needs deliberate composition.

No stock portraits, invented endorsements, decorative film props, fake unread markers, or popularity scores. Film artwork stays tied to the real catalog. A missing poster gets a quiet title-bearing fallback instead of a generic film icon.

## Pass 1: recommendation journey

- Shared components: wrapping choices, quieter content tabs, consistent action styling, author avatars, and writing sections.
- Home: compact personal recommendation preview; a separate people-led discovery card with a full-width response excerpt and shared-film evidence.
- Inbox: person first, title second, note given a readable column; artwork supports recognition.
- Recommendation: person, film, reason, and viewing action have distinct levels; conversation input stays reachable at the bottom.
- Response composer: dedicated writing area, feelings before optional detail, independent enjoyment, expandable highlights, native date/privacy/photo controls.
- Send and reply: the recipient and writing are prominent, detail and preview are available without becoming the whole screen.
- Save continuation: quiet persistence confirmation, then a clear return to the person.

## Original completion criteria

These criteria guided the four passes. Their final disposition is recorded in the acceptance table at the end; the intermediate critiques below are retained as iteration history.

1. Finish checking actual rendering of the recommendation journey, including the final navigation adjustments, keyboard, and longer text. The two core journeys have passed; this is not complete visual acceptance.
2. Carry the same judgment through the response feed, Diary, People and member pages, Search, film details, and account entry. Avoid merely reusing a card everywhere.
3. Improve loading, empty, failed, and returning states where they interrupt the experience. Preserve real source attribution and privacy boundaries.
4. Check compact screens, larger text, light/dark appearance, and accessibility labels for the changed controls. Preserve native back navigation, draft recovery, and save/reply behavior.
5. Compare the actual screens as a connected journey. Record unresolved visual and interaction weaknesses; revise them before declaring the goal complete.

The existing API contract and lifecycle behavior remain the source of truth. This work changes presentation and interaction, not recommendation ranking or visibility rules. The user's final visual feedback is expected after the sustained refinement, not requested as an early permission gate.

## Pass 1 evidence and critique

Both targeted native recommendation journeys passed on iPhone 18 Pro / iOS 27 against disposable fixture accounts: sending a personal recommendation, and receiving one through private viewing, explicit reply, and relaunch. The first receiving run exposed a SwiftUI accessibility identifier inherited by disclosure children; the wrapper identifier was removed and the full journey passed on rerun. The private diary note remained absent from the public-to-participants conversation. The final simulator build passed. Backend behavior was not changed in this design pass.

Actual simulator captures are preserved in [Preview/Design-pass-1](Preview/Design-pass-1): [writing](Preview/Design-pass-1/Writing.png), [choices](Preview/Design-pass-1/Response-choices.png), [inbox](Preview/Design-pass-1/Inbox.png), [recommendation](Preview/Design-pass-1/Recommendation.png), [return](Preview/Design-pass-1/Return.png), [conversation](Preview/Design-pass-1/Conversation.png), [sent](Preview/Design-pass-1/Sent.png), and [Home](Preview/Design-pass-1/Home.png). These are iteration evidence, not final visual approval.

The writing surface is calmer and the original person's reason is easier to read. The captures also show remaining weaknesses:

- Home gives too much vertical space to recommendations before recent responses appear. Rebalance the content before adding more decoration.
- The inbox has readable notes but overly generous row spacing. Review density with long notes and larger text.
- The save receipt still makes its continuation feel like a long stack of unrelated sections. Consolidate the return to the person and the diary action.
- The leading Home wordmark clipped in the iOS 27 toolbar; it has been restored to the centered principal position. The conversation tab bar is now hidden to give the message composer a clear place. These two final adjustments compile but were made after the saved captures and still need visual verification.
- A missing fixture poster exercises the title-bearing fallback. This is an honest missing-art state, not a finished artwork review.

The reference browser tab was closed after inspection. The first pass does not complete the sustained design goal; the remaining screens and adaptive-layout checks above are still required.

## Pass 2: everyday reading and returning

The next audit compared the first-pass Home with the earlier Diary capture. Both delayed the content people came to read. Home placed a nearly full-screen discovery card before the stream; Diary gave its summary and visibility picker comparable weight to the entries themselves.

Two additional primary references informed the interaction decisions:

- [Letterboxd's product guide](https://letterboxd.com/welcome/) makes the viewing date the distinction between a film in a collection and a particular diary event. Moodie already stores separate viewings; the redesign gives their dates a consistent place beside the words. The guide also describes finding people through their writing on shared films, supporting a reading-first path between response and person.
- [Things' design account](https://culturedcode.com/things/features/) keeps optional task details available without giving every field equal prominence. The applicable principle is progressive disclosure. Moodie's recent-viewing summary becomes expandable, and visibility filtering becomes a local control alongside the diary tabs. Its task model, color system, and paper metaphor are not imported.

These are interpretations of published product descriptions, not an installed-app usability study.

Implemented changes:

- Compact the leading discovery card around its author, title, note, and actual shared-film link. Its note opens the full source response. Keep more recommended films after the recent-response stream.
- Give response writing the full available width, with artwork supporting a compact person-and-film header. Keep the source-preserving recommendation action in the response's action row.
- Make a response a focused reading destination, with a reachable comment composer and native back navigation. Report, edit, and delete actions remain available.
- Replace Diary's repeated form controls with reading tabs, a local visibility menu, an expandable recent summary, and a date-led chronological list. Retain search, privacy, swipe editing/deletion, and separate rewatch records.
- Preserve loaded diary content during same-filter refresh failures. Clear old results when search criteria change so unrelated records do not masquerade as matches.
- Group the saved response as one receipt. When attributed to a recommendation, prioritize the original person and the explicit reply; keep Diary nearby and omit a competing recommendation fetch from that state.

The recommendation journey passed in `/tmp/moodie-design-pass2-journeys.xcresult`. The extended feed-to-diary journey passed in `/tmp/moodie-design-pass2-diary-clean.xcresult`, covering public response reading, tab restoration, draft recovery, saving, viewing history, Diary, and relaunch. An initial test lookup used static text instead of the response's actual button accessibility role; a subsequent retry also needed fresh fixture state because the recommendation test had already watched the suggested film. Neither failure was treated as product acceptance. No backend behavior changed.

The actual [Following feed](Preview/Design-pass-2/Following.png), [response reader](Preview/Design-pass-2/Response.png), [Home](Preview/Design-pass-2/Home.png), and [return to a person](Preview/Design-pass-2/Return-to-person.png) show the revised hierarchy. The Home wordmark no longer clips. The native tests verify tab restoration after reading; the focused [conversation](Preview/Design-pass-2/Conversation.png) no longer stacks its composer above the tab bar. The fixture's missing Perfect Days poster was corrected using the image reference on its [TMDB page](https://www.themoviedb.org/movie/976893-perfect-days?language=en-US), and the real art now renders.

The passing functional run exposed a visual defect in [Diary before correction](Preview/Design-pass-2/Diary-before-correction.png): a SwiftUI Label inside the custom wrapping layout stretched the private row. Metadata now uses naturally wrapping text, and Diary explicitly uses an inline title so its history starts sooner. Film-specific viewing history keeps full dates because it has no month section headers. The full journey passed again in `/tmp/moodie-design-pass2-diary-layout.xcresult`. Its [corrected Diary capture](Preview/Design-pass-2/Diary.png) was inspected: the private metadata stays on a natural text line, the blank gap is gone, and separate viewing dates remain visible.

Remaining People, Search, film/member pages, account entry, and adaptive-layout review continue under the same active goal. In the accessibility pass, review action-row wrapping, small text contrast, and the distinction between public comments and personal recommendation replies.

## Pass 3: people, search, and films

This pass carries the reading hierarchy into distinct contexts. The reference principle is not to give every piece of metadata and every action equal weight. A person's page should make the relationship accessible; a film's page should make its responses readable; search should support a quick choice without repeated action strips.

- People now separates Discover from Following. Following someone moves them into the circle; unfollowing returns them to discovery. A row joins their name, a real shared film when available, and their latest written response. Search also matches their bio.
- Member pages have a dedicated identity and relationship area instead of reusing a disabled directory row. “Between you” opens the actual recommendation history for that pair, and sending is offered when the recipient is eligible. Their responses omit the repeated author identity because the page already establishes it. Counts prefer the server's total over a possibly limited connection list.
- Search uses compact result rows with reachable save and compose controls. Saved films form a small shelf; finding a feeling uses visible choices rather than a menu. Refreshes after a save retain existing results, and asynchronous results are checked against the active request before display.
- Film pages give the title, artwork, recording, saving, and recommending a clear place. Source recommendations and their reasons remain prominent. The overview starts as a short excerpt; longer text and backdrop art are available in context. Responses omit duplicate film titles and posters. Related films load only when opened, with their own failure state so a catalog failure cannot replace the response area.
- The public response action says “Comment,” preserving the distinction from a personal recommendation reply. Recommendation buttons now put their 44-point hit area inside the actual label.

Both targeted journeys passed in `/tmp/moodie-design-pass3-journeys.xcresult`: the new People → profile → recommendations → Search → save → film → recommendation composer path, and sending a personal recommendation from the revised film page. The first test also verifies moving between Discover and Following, returning to the same search query, and restoring its temporary follow/save changes. Native builds passed before the run. The final singular/plural count correction is compiled separately.

Inspected captures: [circle](Preview/Design-pass-3/Circle.png), [member](Preview/Design-pass-3/Member.png), [film](Preview/Design-pass-3/Film.png), and [search with keyboard](Preview/Design-pass-3/Search.png). Additional captures preserve [discovery](Preview/Design-pass-3/People.png), [member films](Preview/Design-pass-3/Member-films.png), and [sent confirmation](Preview/Design-pass-3/Sent.png). The member image precedes the “1 follower” copy correction. Fixture runtimes are now populated in the dedicated database column as well as its TMDB payload; the next fresh fixture run will exercise those metadata values.

The inspected layouts keep writing legible and actions reachable at default size. Remaining acceptance work is account entry, desired-feeling search, empty/failure states, compact width, larger text, dark appearance, and a final connected-journey comparison. The goal remains active.

## Pass 4: entry, continuity, and adaptation

Account entry now gives returning people a short form. The introductory statement belongs to sign-up; recovery has its own explanation and field order. Changing entry mode returns the form to its top, keeps the identifier, and clears password fields. Native account settings remain a Form. An unfinished bio survives reading the public profile; leaving with edits offers save, discard, or continued editing.

Loading behavior follows the content's ownership. Home waits for a successful recommendation read before offering the empty-state invitation. A temporary comment-loading failure preserves the response; permission and removal errors clear inaccessible content. People distinguishes an empty community from an already-followed circle.

The accessibility review used actual iPhone 18 Pro captures in dark appearance at the largest accessibility text size. It found a real problem in the discovery card: its shared-film and Keep actions squeezed words into narrow columns. Those actions now stack at accessibility sizes. Response actions wrap, profile connection controls wrap, and film search separates its title from quick actions. The save receipt also separates its metadata and continuation actions when needed. Film actions keep their two secondary controls together below the primary action when the row cannot fit.

Feeling colors now use named assets with light and dark variants. The selected label uses the main text color; a colored mark, outline, and fill provide the feeling's visual character. Decorative avatar initials and poster fallbacks keep their size within their fixed artwork bounds. Icon-only actions retain a 44-point target and a stable symbol size. Reading text and labeled controls continue to scale.

Test development exposed three targeting assumptions: a tap in an existing bio does not guarantee a cursor at the end, a sheet and its underlying page can contain the same film link, and a native search keyboard must be closed before switching tabs. iOS 27 exposes that control as Close; the test now uses the observed control and selects the intended search field by its prompt. Assertions now compare the actual edited text and use the specific presented destination. The largest-text account test also scrolls a virtualized Form row back into view before reading its value. These initial failed runs are not counted as acceptance.

The adaptive run also exposed a dismissal edge case in Account: Discard did not reliably close settings while its alert was dismissing, leaving the edited buffer on screen. Discard now explicitly restores the saved bio and closes through the owning sheet binding. The acceptance check waits for the underlying Account control to become reachable before reopening it. The completed verification and accepted captures are recorded below.

The compact iPhone run also exposed a missing keyboard escape in profile editing. Account now offers a keyboard Done control, separate from leaving settings, and permits interactive keyboard dismissal while scrolling. This keeps the following profile action reachable on a short screen without losing the bio draft.

The final connected-screen review compares the compact [Home](Preview/Design-pass-4/Compact-home.png), [Following feed](Preview/Design-pass-4/Compact-following.png), [member](Preview/Design-pass-4/Compact-member.png), [composer](Preview/Design-pass-4/Compact-composer.png), and [Diary](Preview/Design-pass-4/Compact-diary.png). People and their words remain recognizable across destinations without repeating the same card composition everywhere. Optional [film details](Preview/Design-pass-4/Compact-film-details.png) stay available without permanently preceding the response stream. Truncated previews open full reading destinations; native tab and navigation materials overlay scrolling content as expected.

The inspected maximum-size [discovery](Preview/Design-pass-4/Large-text-discovery.png) and [film](Preview/Design-pass-4/Large-text-film.png) captures show the corrected action layout. The [response](Preview/Design-pass-4/Large-text-response.png) keeps full-size writing and a reachable comment field. Large text necessarily requires more scrolling; it is not reduced to fit the default composition. The selected-label contrast check is documented in the verification record.

The compact conversation capture showed the full reply on screen while XCTest still reported its selectable Text at an old off-screen position. The test retains the exact reply, private-note exclusion, and relaunch checks; full-note visibility is established by inspecting the saved capture. Geometry assertions against that stale accessibility value were removed rather than treated as evidence of clipping.

Expanded film-detail review also caught an incorrect backdrop reference in the disposable Past Lives fixture. The fixture now uses the backdrop published on its [TMDB page](https://www.themoviedb.org/movie/666277-past-lives?language=en-US). This corrects QA sample metadata; it does not change live catalog fetching.

## Final local acceptance

The final compact run passed both the existing diary/persistence journey and the recommendation viewing/reply/relaunch journey in `/tmp/moodie-design-pass4-reading-final.xcresult`. The final [reply](Preview/Design-pass-4/Compact-reply.png) and [expanded film details](Preview/Design-pass-4/Compact-film-details.png) were inspected from that passing run. Its captures replace the earlier compact Home, Following, composer, and Diary images. The reply's complete note is readable, its explicit enjoyment and highlight remain separate, and the private diary note is absent.

| Criterion | Final evidence and scope |
| --- | --- |
| Complete personal recommendation journey | Send with a reason; receive; record a private viewing; choose a separate reply; reopen after relaunch. Native checks preserve attribution and private-note exclusion. |
| Cohesion beyond one screen | Four passes cover Home, inbox/conversation, composing and returning, response reading, Diary, People/member history, Search, film detail, and account entry. Actual captures were compared as connected destinations. |
| Continuity and meaningful states | Draft recovery, same-query return, follow/save state, bio navigation/discard, auth failure/retry, and empty discovery/search are exercised. Loading and failure ownership were revised in source; network-failure permutations were not exhaustively UI-tested. |
| Compact and adaptive layouts | Six distinct journeys passed on the 375-point iPhone SE simulator across the final pass's runs. Two scoped journeys passed at the largest accessibility text size in dark appearance on iPhone 18 Pro. Changed native control labels and hit targets were reviewed. |
| Revision after visual critique | Corrected stretched Diary metadata, oversized initials/icons, crowded large-text actions, profile keyboard escape, sheet discard, and fixture artwork. Final relevant captures were inspected after the corrections. |

The shared backend and Foundation core were unchanged by these visual passes; their lifecycle checks remain recorded in [VERIFICATION.md](VERIFICATION.md). The final native test run compiled the current production sources. The disposable API was stopped, the temporary compact simulator removed, and the pre-existing simulator retained with its original light appearance and Large text setting.

The result is ready for the user's detailed taste and experience review. This is not a claim that visual taste is objective or that published reference apps establish market demand. Physical-device testing, full VoiceOver operation, iPad layouts, signing, production deployment, and App Store release remain separate work. No web presentation or TV/episode model was added. The [portable interaction rules](DESIGN.md#portable-interaction-rules) and existing OpenAPI contract keep a later web translation concrete without introducing a shared UI framework now.
