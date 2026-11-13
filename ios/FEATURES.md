# iOS v1 feature and interface contract

Status: active development. A passing build is not feature completion or market readiness. This pass completes product flows; visual polish and the release gate follow separately.

## Product loop

Record a viewing → read what you saved → meet someone through a shared film → find or save another film → return to your diary and circle.

Home, Search, People, and Diary remain the four main destinations. Add response is a sheet. Activity lives off Home; Account lives off Diary. Recommendations enter through responses and shared films, never through a separate recommendation tab.

| Area | v1 interface and behavior | Completion evidence required |
| --- | --- | --- |
| Accounts | Sign up, recovery code, sign in, restored session, profile, password, sign out, deletion | Native first-account and recovery/deletion journeys, including failed requests |
| First use | Empty diary has a direct first-response action; community and people remain browsable | New account can reach a useful action without seed history |
| Home | For you, Following, Everyone; real film paths, circle responses, connected people, saved films; explicit community fallback | Follow changes the circle; absence of a recommendation is not described as a first-time state |
| Search | Films, Feelings, People; idle saved/community films; film actions; honest empty results | Choose a saved film without typing; title paging and desired-feeling provenance work |
| Composer | Film, words, independent feelings, date, privacy, optional photo, local draft, edit, rewatch | Keep and recover draft; errors retain content; existing drafts are not silently replaced |
| After saving | Confirm the recorded response and visibility; read it; show one real next-film path; open Diary or People | Saving leads somewhere useful; recommendation failure never looks like a failed save |
| Diary | Read before editing; month groups; search all history; private/public filter; rewatch count; recent viewing feelings | Search is applied before server pagination; reading, editing, deleting and revisiting all work |
| Film history | All of the owner's dated viewings of one film, with words and feelings; add another viewing | Private notes stay owner-only and rewatches remain separate |
| Recommendations | Open shared film, source person, exact source response and destination film; save destination | Every piece of evidence is navigable; no compatibility score or invented source |
| People | Discover/Following, shared-film context, follow/unfollow, profile Responses/Films, followers/following | People lists and profiles form a navigable circle, including the owner's public profile |
| Conversation | Full response, like/unlike, comments, delete own comment, exact activity links | No truncated reading destination; privacy and ownership enforced |
| Safety | Standalone block, report, blocked list and unblock | Blocking does not require a fabricated report; blocked content disappears |
| Account and care | Profile, public-profile link, privacy, guidelines, support, credits, delete account | Destructive actions confirm intent; service failures remain recoverable |

## This implementation pass

Implemented the missing save continuation, diary reading/history/search, recommendation navigation, daily-return Home, idle search, member connections, and standalone blocking. The existing native visual system is retained while those flows take shape. Activity now includes followed public responses, and account creation/recovery ask for password confirmation.

The expanded native test covers a saved draft, confirmed save, reading the saved response, opening viewing history, entering Diary, and restoring the session after relaunch. API tests cover complete-history search before pagination, literal query characters, owner-only rewatch history, the 30-day summary, actual follow state in connection lists, and private/blocked activity boundaries. This does not establish native acceptance for every row in the table.

## Later product decisions

The Beli-inspired recommendation lifecycle is now a separate accepted product decision: [specification and API](../docs/RECOMMENDATION_LIFECYCLE.md). Home, People, film pages, saved responses, and Diary connect to recommendations with explicit send/discovered origins, personal reasons, linked viewings, enjoyment, highlights, opt-in replies, and private conversations. The composer uses feeling choices with optional intensity adjustment. These conversations are scoped to a recommendation, not a general direct-message inbox. Recommendations still do not become a fifth main tab.

A replacement for the provisional seven feeling keys, collections, importing another diary, push notifications, direct messages, subscriptions, and a new brand direction are not assumed requirements. Each needs a product decision before implementation. Email-based recovery remains an explicit product/operations decision, rather than a capability implied by an email field.

## Separate release work

Visual acceptance, complete native scenario coverage, offline/interrupted-write behavior, accessibility/device coverage, production deployment and backup operations, moderation operations, signing, public policies, and TestFlight remain open until verified. See [release requirements](AppStore/RELEASE.md). This feature document does not close those requirements.

Native diary creates now carry a draft-persisted idempotency key; duplicate requests are covered by API tests. Transport-level fault injection, broader offline acceptance, and older web clients without keys remain separate reliability work. Moderation currently requires stopping the API, and account recovery remains code-only. These remain explicit release concerns.


## September 25 platform alignment additions

Activity accepts stable backend event IDs while retaining decoding compatibility with older responses. Report success is preserved if optional blocking fails; Retry block only repeats the block. Blocked people loads 30 at a time with explicit continuation, and successful unblocking remains visible if refreshing the list fails. The complete simulator app build and 14 core tests passed; new UI interaction tests for these additions remain pending. Shared architecture and AWS direction are recorded in `../docs/adr/0001-platform-data-and-ai-boundaries.md`.


Profiles, connections, film responses, comments, people search and saved-film history now request explicit pages. Profile film counts and response/comment totals come from the API; recommendation eligibility uses `follows_you`, never a connection-page membership guess. Film catalog failures do not erase responses. Home reads are independent, and global saved data is a 12-film preview with authoritative per-film saved checks. Complete saved history remains accessible through Diary and Search's saved picker. The final app compile and cross-client HTTP/Swift check are recorded in [Platform alignment](../docs/PLATFORM_ALIGNMENT.md). These checks do not close the separate native release requirements above.
