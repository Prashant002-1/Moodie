# Roadmap

Last updated 2026-11-13. This follows [PHILOSOPHY.md](PHILOSOPHY.md) and [IDENTITY.md](IDENTITY.md). It is an ordering, not a schedule. Reorder it freely.

## Where things stand

One Express API and PostgreSQL schema serve two clients: a React web app and a native SwiftUI iPhone app. Both run locally against the same data and cover accounts, the diary, personal recommendations with replies and conversations, people, feeds, search, safety, and now the AI choice. A private AWS development stack (EC2 and RDS) exists but the application has never been uploaded to it. Nothing is deployed for real use and nothing has been tested on a physical phone.

Run it locally with `npm run preview:demo` (see the README).

## 1. Get it onto a real phone

The shortest path to the App Store. Nothing here is a design question; it is plumbing and paperwork.

- [ ] Upload and start the API on the existing AWS stack, then apply migration `202611130001-ai-mode.sql`. (Blocked on your approval of the image upload and of placing the TMDB key in the runtime secret. See [AWS_DEVELOPMENT_VERIFICATION.md](AWS_DEVELOPMENT_VERIFICATION.md).)
- [ ] A public HTTPS address for the API. The current stack has no inbound access by design.
- [ ] Apple Developer Program membership, a bundle identifier and signing. Then TestFlight.
- [ ] Public privacy policy and support pages. The App Store requires both.
- [ ] Move optional photos out of the database into private object storage (S3).
- [ ] A moderation routine that does not require stopping the API.
- [ ] A written answer from TMDB on commercial use and on AI features (see Risks).

## 2. Close the gaps against the philosophy

In rough priority order.

- [ ] **Feelings without measurement.** The web now records up to three words in order with no numbers shown ([FEELINGS.md](FEELINGS.md)). Remaining: decide the vocabulary (a sixteen-word proposal is in that file), then store an ordered word list on the server and rebuild matching on word overlap.
- [ ] **A recommendation link for someone without an account.** The strongest answer to the empty-network problem ([IDENTITY.md](IDENTITY.md)).
- [ ] **Letterboxd import.**
- [x] **Discovery that reads what people made of a film.** Films through follows, picks that landed, shared films and friends of friends; people to meet; who to send a film to; first answers for a newcomer. Built on the web and API ([DISCOVERY.md](DISCOVERY.md)). Remaining: move the iPhone app onto it, then retire `/api/recommendations`.
- [ ] **"Who would like this and why"** as part of a response. After saving, the web now suggests followers the film might suit; the "why" is still written only when sending.
- [ ] **Gentle memory.** Notifications that carry the person and the reason: push on iOS (APNs), an in-app return trail everywhere. Quiet by default, never a streak.
- [ ] **Television.** Titles need an identity that is not a TMDB movie id: a `titles` table keyed by media type and catalog id, with shows, and later seasons. This touches every table that references a film, both clients and the three OpenAPI contracts, so it should happen before real accounts exist.
- [ ] **First AI-mode features.** A model provider behind the existing explanation port (Amazon Bedrock is the natural fit for AWS credits) and an authenticated MCP endpoint exposing the two read tools, both gated by the account's AI choice.
- [ ] **Profile as a shelf.** Favourites and what a person is recommending.
- [ ] **Export.** A person can take their diary with them.

## 3. Design system

The web runs on one stylesheet (`src/styles/app.css`) built from `design/tokens.json`, in light and dark, with one navigation. See [DESIGN.md](../DESIGN.md).

- [ ] Your review of the web design: palette, type, navigation, composer. Everything else waits on this.
- [ ] Move the iPhone app to the same system: its own bottom bar instead of the system tab bar, the new feelings picker, no feeling colours, the same copy rules.
- [ ] A pictorial brand mark and app icon. The interface uses a wordmark only.
- [ ] A separate product page for people who have never heard of Moodie. The signed-out front page is deliberately one sentence.
- [ ] Motion: one considered set of transitions shared by the clients.

## 4. Android

Not started. Two honest options:

- **Kotlin and Jetpack Compose**, mirroring the SwiftUI app against the same API contracts and tokens. Best result per platform. Three interfaces to keep in step.
- **Replace both mobile apps with one React Native app.** One mobile codebase that shares types with the web. Costs the existing SwiftUI app and some native feel.

Recommendation: ship iOS in SwiftUI first, because it exists and works, then build Android in Compose from the same contracts once the product has stopped moving. Revisit if keeping two native apps in step starts to slow everything down.

## Risks to keep in view

From [MARKET_LANDSCAPE.md](MARKET_LANDSCAPE.md). Each should be checked at its source before a decision depends on it.

- **TMDB terms.** Reported there: any revenue requires a commercial licence at an unpublished price, and the written terms restrict use in connection with AI or machine-learning applications. This could affect AI mode, the learned recommender and any future pricing. Get it in writing.
- **Cold start.** A people-driven product is empty without people. The diary must be worth using alone.
- **"Mood" reads as a gimmick.** The name leans into the weakest version of the idea.
- **Incumbents.** Sending a title to a friend with a note is a small feature for a large app to add.
- **Tracker economics.** Several trackers have closed or cut back. Decide early how Moodie pays for itself.

## Things only you can do

- Approve the AWS image upload and TMDB key transfer, or say no.
- Join the Apple Developer Program and, later, Google Play.
- Decide the feeling vocabulary and whether the name stays.
- Provide or commission the brand mark, icon and any imagery or sound. Tell me if you would like generated options and I will say which tool I need connected.
