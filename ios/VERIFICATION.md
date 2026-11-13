# Native verification

**Native refinement completed locally on September 22, 2026; release requirements remain open.** Evidence here is limited to the checks named. See the [design record](DESIGN_EVOLUTION.md) and [feature contract](FEATURES.md) for implementation scope. Historical entries below preserve the state of each earlier run.

## September 22, 2026: final compact acceptance

Six distinct native journeys passed on a temporary iPhone SE (3rd generation) simulator, 375 × 667 points, with iOS 27. These results span three runs, not one uninterrupted all-green suite:

| Journey | Passing result bundle |
| --- | --- |
| Feeling discovery, shared-film path, response reading, and empty states | `/tmp/moodie-design-pass4-compact.xcresult` |
| People/following, member recommendation history, Search/save/return | `/tmp/moodie-design-pass4-compact.xcresult` |
| Send a recommendation with a personal reason | `/tmp/moodie-design-pass4-compact.xcresult` |
| Account entry, unfinished bio, profile navigation, keep/discard/reopen | `/tmp/moodie-design-pass4-compact-final.xcresult` |
| Existing response, draft, save, viewing history, Diary, and relaunch | `/tmp/moodie-design-pass4-reading-final.xcresult` |
| Recommendation viewing, explicit reply, private-note exclusion, and relaunch | `/tmp/moodie-design-pass4-reading-final.xcresult` |

The last bundle completed with two tests and zero failures and compiled the final native production sources. Earlier compact failures led to a real profile keyboard-dismissal fix and correction of an unreliable XCTest geometry assertion for selectable text. The final conversation capture visibly contains the whole reply; semantic, privacy, and persistence assertions remain in the test. The [design record](DESIGN_EVOLUTION.md) retains the critique and limitations.

Final [compact reply](Preview/Design-pass-4/Compact-reply.png), [film detail](Preview/Design-pass-4/Compact-film-details.png), [Home](Preview/Design-pass-4/Compact-home.png), [Diary](Preview/Design-pass-4/Compact-diary.png), and [composer](Preview/Design-pass-4/Compact-composer.png) captures are preserved in the repository. The separately passed dark/maximum-text checks are described below. Backend and core behavior did not change during these design passes, so the earlier regression suites were not repeated. `git diff --check` passed after the final documentation changes.

Cleanup stopped the disposable fixture API and removed the temporary compact simulator. The pre-existing iPhone 18 Pro simulator was retained, and its light appearance and Large text size were verified. No commits, pushes, deployment, or distribution signing were performed. Physical-device, full VoiceOver, iPad, and production-service acceptance remain open.

## September 21, 2026: first native design iteration

The [design record](DESIGN_EVOLUTION.md) documents reference research, decisions, screenshots, and unresolved issues. Both recommendation UI journeys passed across two runs against a disposable local API: send with a personal reason; receive, save a private viewing, send a separate reply, and reopen after relaunch. The receiving journey was rerun after fixing a disclosure accessibility identifier. Result bundles: `/tmp/moodie-design-pass-journey.xcresult` (send passed; initial receiving run failed) and `/tmp/moodie-design-response-journey.xcresult` (receiving rerun passed).

The final Swift simulator build passed after the toolbar and conversation tab-bar adjustments. Those last two layout adjustments are compile-verified only. Screenshots in `Preview/Design-pass-1` precede them. Backend/core suites were not rerun because this pass changed native presentation and its UI test interactions. Full adaptive-layout and remaining-screen review is still open. This is design progress, not completion or release evidence.

## September 22, 2026: reading, Diary, and returning

The extended feed-to-diary journey and the recommendation viewing/reply journey passed across `/tmp/moodie-design-pass2-diary-clean.xcresult` and `/tmp/moodie-design-pass2-journeys.xcresult`. Reading now explicitly verifies hidden tabs on the response screen and their restoration on return. An initial static-text lookup was corrected to the actual response button role; a later retry required fresh fixture state after the earlier recommendation viewing. The send path was not rerun in this pass.

Screenshot review found stretched private Diary metadata even though the functional checks passed. After replacing that layout, the full diary journey passed again in `/tmp/moodie-design-pass2-diary-layout.xcresult`; the resulting [Diary image](Preview/Design-pass-2/Diary.png) was inspected and the spacing defect is resolved. The final native build passed. Updated screenshots and remaining critique are in [the design record](DESIGN_EVOLUTION.md). These are local simulator checks with disposable accounts, not deployment or release acceptance.

## September 22, 2026: people, search, and film continuity

Both journeys in `/tmp/moodie-design-pass3-journeys.xcresult` passed: People discovery/following, member recommendation history, Search/save/return continuity, and sending from the revised film page. The final native simulator build passed after the singular follower-count correction. Captures in `Preview/Design-pass-3` precede that minor copy correction and the fixture runtime-column repair. Backend and core behavior did not change, so their earlier suites were not repeated. This remains local simulator evidence.

## September 21, 2026: personal recommendation lifecycle

The [research and product decisions](../docs/BELI_RESEARCH.md), [lifecycle specification](../docs/RECOMMENDATION_LIFECYCLE.md), and [OpenAPI 3.1.1 contract](../docs/api/suggestions.openapi.json) accompany the implementation. The standard/library check kept existing Zod validation and Swift Codable without adding dependencies.

| Check | Result |
| --- | --- |
| Shared API regression suite | 66 tests passed across 13 suites under Node 22 |
| Recommendation API coverage | Nine tests cover send/save/view/reply/message, source attribution, consent, ownership, privacy, retry identity, archive/restore, retraction, blocks, deletion, pagination, and Activity compatibility |
| Foundation core | 13 tests passed, including old-draft decoding, retained attribution/retry keys, and reply decoding |
| Native recommendation journeys | Two passed on iPhone 18 Pro / iOS 27: receive to private viewing to separate reply to relaunch; send a film to a chosen person with a personal reason |
| Existing native diary journey | Passed after the final changes: search, keep/reopen draft, save, read response, viewing history, Diary, and signed-in relaunch |
| Native simulator build | Final Swift 6 build passed after the conversation retraction and composer refinements |
| Application builds | Web/API build passed; final backend TypeScript build passed |
| Portable contract | Valid JSON, six path items, all 83 local references resolved; lifecycle/privacy decisions documented |
| Whitespace check | `git diff --check` passed |

The native tests used real HTTP requests against a disposable local API on port 3101 and fictional fixture accounts. The viewing-to-reply test saved a private diary note, sent a different explicit reply, verified that the private note was absent from the conversation, and reopened the reply after relaunch. The API tests exercise both participants, including private-viewing inference through query filters and message access after reply retraction. The latest native compile and backend suite include those final refinements.

Screenshots from the passing recommendation run: [inbox](Preview/Recommendations.png), [personal reason](Preview/Personal-recommendation.png), [response composer](Preview/Recommendation-composer.png), [return to the person](Preview/Recommendation-return.png), [explicit reply and conversation](Preview/Recommendation-reply.png), and [sent recommendation](Preview/Recommendation-sent.png). The result bundle is `/tmp/moodie-recommendation-accepted.xcresult`. Screenshots are copied into the repository; temporary result bundles can be removed by the operating system.

The new native tests are `RecommendationJourneyTests`. Run them with the fixture from [README.md](README.md), adding `-only-testing:MoodieUITests/RecommendationJourneyTests -collect-test-diagnostics never` to the Xcode test command. Restart the disposable fixture before repeating a mutating journey. The backend suite and core tests need no simulator.

The existing diary journey was rerun separately against the final API and native sources; its result bundle is `/tmp/moodie-existing-journey-final.xcresult`. All three simulator journeys passed across these two runs.

This is iPhone-first local implementation against the existing film catalog. Web presentation, TV identity and episode/season progress, production deployment, push delivery, physical-device acceptance, distribution signing, and App Store release are not established by these checks. Existing unrelated working changes were preserved; nothing was committed, pushed, or deployed for this task.

## Earlier native baseline

Local validation on September 20, 2026. The simulator used a disposable QA database created by `scripts/start-fixture.ts`. Existing personal data was not used or reset.

| Check | Result |
| --- | --- |
| Toolchain | Xcode 27.0, build 27A266a; iOS 27.0 SDK |
| Deployment target | iOS 18.0; iPhone and iPad |
| Native simulator build | Passed, including Swift 6 concurrency checking |
| Foundation core | 11 tests passed across domain, draft, and HTTP contract suites |
| Existing backend plus native features | 56 tests passed across 12 suites under Node 24.19.0; after the visibility fix, all 6 focused native API regression tests passed; TypeScript check passed |
| Native journey | Search, keep/reopen draft, save confirmation, full response reading, viewing history, Diary, and signed-in relaunch passed on iPhone 18 Pro / iOS 27.0 |
| Release preflight | Missing production URLs and Apple team rejected as expected |
| Whitespace check | `git diff --check` passed |

The native journey runs through the real local API, including server persistence and Keychain session restoration. Separate core tests cover input validation, independent feeling intensities, snake-case response decoding, explicit photo removal, account-scoped draft files, cookie persistence, session expiry, unsafe URLs, malformed responses, and request encoding. Server tests cover reciprocal blocks, public/private boundaries, report validation, moderation filtering, restricted-account behavior, and account deletion.

Screenshots from the expanded passing run: [Home](Preview/Home.png), [Composer](Preview/Composer.png), [Saved response](Preview/Saved-response.png), [Diary](Preview/Diary.png). These show disposable fixture accounts and content, not a production community or the user's personal diary. The local Xcode result bundle is `/tmp/moodie-feature-journey.xcresult`; temporary build/test artifacts may be removed by the operating system. A subsequent native compile passed after adding the explicit Activity query flag; its API behavior is covered by the server tests.

The latest changes add server-side complete-history search, private/public and film filters, owner-only rewatch counts, a past-30-days viewing summary, actual follow state in member lists, complete shared-film feeling vectors, and optional followed-response activity. The default Activity API remains compatible with the existing web client. Public response endpoints now retain visibility so editing does not implicitly change it.

Simulator runs use Xcode's local ad-hoc signature. No Apple distribution identity, signed device archive, TestFlight upload, App Store Connect submission, public API deployment, or public access was verified. Physical-device, iPad, VoiceOver, maximum text-size, photo-picker, and production-service acceptance remain part of the [release gate](AppStore/RELEASE.md).

The Xcode logs include platform messages about unused App Intents metadata and an iOS 27 accessibility-loader duplicate. The simulator also logs a transient layout warning when focusing its multiline text field; the field accepted and persisted text during the native journey. These messages did not fail the build or passing journey, but device acceptance remains necessary.

Reproduction commands are in [README.md](README.md). No commits, pushes, or deployments were made for this native implementation.

## September 22, 2026: account and maximum text-size checks

Two journeys passed in dark appearance at `accessibility-extra-extra-extra-large` on iPhone 18 Pro / iOS 27, across `/tmp/moodie-design-pass4-accessibility-accepted.xcresult` (account passed) and `/tmp/moodie-design-pass4-feelings-accepted.xcresult` (feeling discovery and empty states passed). Account coverage includes sign-in failure and retry, sign-up/recovery entry, preserving an edited bio through profile navigation, keeping editing, discarding, and reopening. Discovery coverage follows a desired feeling through a shared film and a person into a film and response, switches to related films, and checks People and film-search empty states.

Earlier runs exposed test targeting assumptions as well as real layout and dismissal issues. The [design record](DESIGN_EVOLUTION.md) distinguishes them. Actual captures were inspected; the squeezed discovery actions and oversized decorative initials/icons were corrected. Selected-label nominal sRGB contrast, computed from the final color assets and tinted fill, is at least 10.71:1 in light appearance and 11.29:1 in dark appearance. This calculation is limited to that control, not a complete accessibility certification.

The original iPhone 18 Pro settings were restored to light appearance and Large text. Full VoiceOver, iPad, physical-device, and release acceptance remain outside these local checks.
