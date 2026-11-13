# Moodie for iOS

**In active development. Not market-ready.** The feature and interface contract is in [FEATURES.md](FEATURES.md). The checks below establish specific local behavior, not completion of the app or its release requirements.

A native SwiftUI client for Moodie's existing Express API. Supports iOS 18 and later, iPhone and iPad. Built with the installed Xcode 27 SDK. No third-party iOS packages, JavaScript bridge, WebView shell, analytics SDK, or client-side TMDB secret.

## Open and run

Open `ios/Moodie.xcodeproj` in Xcode, select the **Moodie** scheme and an iPhone simulator, then Run. Debug connects to `http://127.0.0.1:3001/api` by default. Start the existing API with `npm run dev:api` from the repository root. Keep the existing persistent database configuration; never seed or reset a personal database for native testing.

For a physical iPhone, use an HTTPS API accessible from the phone. Copy `Config/Local.xcconfig.example` to `Config/Local.xcconfig`, fill in the API URL and Apple team, and choose a unique bundle identifier. The Local file is ignored by Git. Loopback HTTP is permitted only in Debug. Release refuses insecure hosts.

The generated project is checked in. Regenerate it after adding a Swift source:

```sh
python3 ios/scripts/generate_project.py
```

## Implemented journeys

- Sign in, individual sign-up, one-time recovery code presentation, recovery, secure persistent sessions, profile, password rotation, sign-out, and permanent account deletion.
- Home with For you, Following, and Everyone, circle responses, connected people, and saved films. Real recommendation provenance links the person, shared film, both feeling mixes, and exact source responses. Cursor-based feed pagination.
- Search across films, desired feelings, and people. Saved and community films are available before typing, including in the composer. Film details, related films, community responses, and saved-film actions.
- A native composer with film selection, a first-person note, independent feeling intensities, viewing date, per-response visibility, rewatches, and an optional system photo picker. Photos are resized and re-encoded without source metadata before upload.
- Account-scoped, atomic, file-protected local drafts, kept out of backup. Private is the default. Failed writes retain the form. Saving confirms the response and offers a real next-film path. Diary supports reading, month groups, complete-history search, recent feelings, per-film rewatch history, editing and deletion. Saved films have a separate view.
- People discovery, following, profiles, follower/following lists, likes, comments, activity including circle responses, reports, and standalone reciprocal blocks enforced by the backend.
- Personal recommendations with a recipient and reason, keeping a film through someone's response, received/sent/archived history, private viewing attribution, an explicit reply after viewing, and participant conversations. Enjoyment and memorable details supplement feelings; precise intensity sliders remain available.
- System tab bars and navigation stacks, Dynamic Type, light/dark appearances, accessible feeling labels, native keyboard handling, retry/error/empty states, and a privacy cover in the app switcher.

## Architecture

`Moodie/` contains SwiftUI features, observable session state, Keychain storage, and a small native design system. `MoodieCore/` is a local Swift package with Foundation-only models, the API actor, feeling semantics, input validation, and draft persistence. The core can be tested without booting an iOS runtime.

Network requests use an ephemeral URLSession, carry the API's existing CSRF header, and persist only the session token in a device-only Keychain item. Redirects are restricted to the same origin. API response keys decode from snake_case; request payloads retain the API's camelCase fields. Cookies rotate after password/recovery changes. No passwords are stored by the app.

The server additions are `routes/safety.ts`, `services/communitySafety.ts`, safety tables in `database/schema.sql`, and shared read/write guards. The app needs that server version for report/block functionality.

The recommendation journey uses `routes/suggestions.ts`, `services/suggestionService.ts`, additive schema changes, and Foundation-only Codable models. Its [product and lifecycle spec](../docs/RECOMMENDATION_LIFECYCLE.md), [research](../docs/BELI_RESEARCH.md), and [OpenAPI 3.1.1 contract](../docs/api/suggestions.openapi.json) document the behavior for a later web implementation. No new dependencies were added. The current catalog remains film-only.

## Verify

```sh
# Pure Swift model, draft, and HTTP contract tests
swift test --package-path ios/MoodieCore

# Native build, no signing needed
xcodebuild -project ios/Moodie.xcodeproj -scheme Moodie \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/moodie-derived CODE_SIGNING_ALLOWED=NO build

# Disposable QA API. Creates its own temporary DB and sample accounts.
node --import tsx ios/scripts/start-fixture.ts

# With the fixture running, choose an installed iPhone simulator.
xcodebuild -project ios/Moodie.xcodeproj -scheme Moodie \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 18 Pro' \
  -derivedDataPath /tmp/moodie-derived \
  MOODIE_API_URL=http://127.0.0.1:3101/api -collect-test-diagnostics never test
```

Leave simulator signing enabled when running the app or UI tests: Xcode’s local ad-hoc signature supplies the simulator Keychain entitlement. `CODE_SIGNING_ALLOWED=NO` is only for compile checks.

The fixture is development-only and is never bundled in the app. It has a deliberately disposable `ios_viewer` account with password `native-test-password`. It does not contact the live TMDB API or write to the user's existing database. Poster requests still use TMDB's image CDN.

Release builds have a preflight that refuses empty, local, or placeholder service URLs and a missing Apple team. See [verified results](VERIFICATION.md), [App Store release requirements](AppStore/RELEASE.md), and [native design decisions](DESIGN.md).

## Private AWS development backend

From the repository root, run `python3 infra/aws/moodie.py tunnel`. The web app is then available at `http://127.0.0.1:3301`, and the API at `/api`. The server and database run in AWS; only the encrypted Session Manager tunnel runs on this Mac.

`Config/DebugLocal.xcconfig` can override Debug with that loopback API address; copy its example if needed. It is ignored by Git and does not affect Release. This works in the iPhone simulator on the same Mac. Physical iPhone access, a public HTTPS address, Apple signing, and TestFlight remain separate setup steps.
