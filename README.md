# Moodie

Moodie is emotion-based social film discovery.

> Moodie uses the TMDB API for non-commercial purposes and is not endorsed or certified by TMDB.

The existing hosted demo is a previous release. The account-enabled application runs on the persistent Express server described below.

No two people feel the same. Moodie starts there. A person records what a film meant to them and the feelings that stayed. The product finds people who responded similarly to the same films, then opens a path to what moved those people next.

It does not treat a person as a rating, genre profile, or point in a recommendation system. The person, the shared film, and the response behind each recommendation remain visible.

## Why I built it

Most film recommendation systems flatten taste into ratings, genres, and popularity. I built Moodie around the part those systems miss: what a film meant to someone and what stayed with them afterward.

That decision shaped the product. Responses replace ratings. People and shared films create recommendations instead of universal emotion-to-genre rules. Optional photos add context but never decide what a person felt.

## How the experience fits together

### Respond instead of rating

A response pairs a first-person note with feeling sliders. The note preserves why the film mattered, while the sliders capture mixed feelings without forcing the viewing into one label or score. It can stay private or be shared publicly, with an optional photo that adds context but is never analyzed.

### Keep a personal film history

Each viewing becomes its own diary entry, so rewatches can hold different notes and feelings. Search and visibility filters keep that history usable, while saved films remain separate from films already watched.

### Discover through other people

Public responses enter For you, Following, and Everyone feeds, with the person, film, note, and feelings kept together. Follows build a circle of people whose taste they understand. Likes and comments stay attached to the response instead of becoming a film score. The For you view also keeps recommendations, connected people, recent community films, and saved films within reach.

### Follow the reason behind a recommendation

Moodie connects people through a shared film and overlapping feelings, then introduces another film through that person's public response. The person, shared film, and source response remain visible, so the path can be understood and explored. Search extends the same experience across films, feelings, and people.

[`PRODUCT.md`](./PRODUCT.md) defines the product philosophy and journeys. [`docs/EMOTIONAL_SIGNAL_MODEL.md`](./docs/EMOTIONAL_SIGNAL_MODEL.md) defines emotional evidence, people-led matching, media separation, and consent. [`DESIGN.md`](./DESIGN.md) defines the Living Afterimage interface system.

## Stack

- React 19, TypeScript, Vite, React Router, Lenis, and Oxygen
- Express, local PGlite or hosted PostgreSQL, revocable cookie sessions, and Zod validation
- TMDB for server-side film metadata and artwork
- Vitest, React Testing Library, Jest, and Supertest

## Architecture

`React / SwiftUI clients → Express API → PGlite (local) or PostgreSQL (AWS)`

React and TypeScript handle the interface through one authenticated API client. Express groups catalog, diary, library, discovery, recommendation, and account routes, and proxies TMDB so its key stays off the client. The selected database stores diary and social data; local development defaults to PGlite, and the AWS runtime uses managed PostgreSQL. Vite proxies `/api` locally; the production Express process serves both the React build and API on one origin.

The SwiftUI iPhone client in [ios](ios/README.md) uses the same API and data. Cross-platform implementation, architecture decisions, and local acceptance evidence are tracked in [Platform alignment](docs/PLATFORM_ALIGNMENT.md). Web types are generated from the [recommendation](docs/api/suggestions.openapi.json), [library](docs/api/library.openapi.json), and [social/safety](docs/api/social.openapi.json) OpenAPI contracts with `npm run contracts:generate`; `npm run contracts:check` runs during the web build to detect drift. The embedded database currently supports one API process, not multiple replicas.

## Product routes

- `/`: public product overview
- `/signup`, `/signin`, `/recover`: account access and recovery
- `/account`: public bio, password, sign out, and account deletion
- `/feed`: signed-in response stream with personal film paths woven into it
- `/search`: film and people search with community and shared-film context
- `/people`: followed and discoverable people with shared-film context
- `/activity`: reactions, follows, and recent responses from people followed
- `/recommendations`: a contextual continuation reached from a personal film path, not primary navigation
- `/suggestions`, `/suggestions/new`, `/suggestions/:id`: personal recommendation history, sending, and participant conversations
- `/response/:id`: exact response reading, including the owner's private viewings
- `/diary`: personal response history
- `/log`: add a film response
- `/movie/:id`: film details and public responses
- `/member/:username`: public member responses

## Current APIs

- `GET /api/catalog/trending`
- `GET /api/catalog/popular`
- `GET /api/catalog/genres`
- `GET /api/catalog/search?q=`
- `GET /api/catalog/movies/:movieId`
- `GET /api/catalog/movies/:movieId/related`
- `GET|POST /api/diary`
- `GET /api/diary/summary`
- `PATCH|DELETE /api/diary/:entryId`
- `GET|POST|DELETE /api/library/saved`
- `POST /api/recommendations`
- `GET /api/discovery/feed`
- `GET /api/discovery/people`
- `GET /api/discovery/people/:username`
- `GET /api/discovery/films/:movieId`
- `GET /api/discovery/activity`
- `GET /api/discovery/pulse`
- `POST|DELETE /api/discovery/people/:personId/follow`
- `POST|DELETE /api/discovery/entries/:entryId/like`
- `GET|POST /api/discovery/entries/:entryId/comments`
- `DELETE /api/discovery/comments/:commentId`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `POST /api/auth/password`
- `POST /api/auth/recover`
- `DELETE /api/auth/account`

## Where to start

- [Philosophy](docs/PHILOSOPHY.md): what Moodie is for and the principles everything else follows.
- [Roadmap](docs/ROADMAP.md): where the build stands and what comes next.
- [Market landscape](docs/MARKET_LANDSCAPE.md): who else is here and what is still open.
- [Design system](DESIGN.md): the visual direction and the shared tokens in `design/tokens.json`.

## Preview it

```bash
npm install
npm run preview:demo
```

This starts a disposable API with sample people and films, plus the web app at `http://localhost:5273`. It never opens your personal database, and everything is discarded when you stop it. Sign in as `ios_viewer` with password `native-test-password`, or sign up to see the first-run choice between Moodie with and without AI. To see it on a phone, open the Network address that Vite prints from a phone on the same Wi-Fi. To run the native iPhone app against the same preview, see [ios/README.md](ios/README.md).

## Run locally

Requirement: Node.js 20 through 25. Node.js 22 is the recommended local runtime (`.nvmrc`); npm fails to start under Node 26. Docker and a system database are not needed.

```bash
npm install
cp .env.example .env
```

Add a TMDB API key to `.env` to enable live film metadata:

```dotenv
TMDB_API_KEY=your-tmdb-api-key
```

Start the application (seeding a sample community is optional):

```bash
npm run catalog:import  # Optional: import the 86 bundled films without sample people or responses
npm run dev
```

Open `http://localhost:5173`. The root command runs the web app and API together. Vite proxies `/api` internally, so there is no frontend API URL to configure.

Choose **Sign up**, create your own account, and save the recovery code in a password manager. New accounts start with an empty diary and no follows. Sign in later with your email or username. If you forget your password, the saved recovery code resets it and signs out existing sessions. No email delivery service is required or implied.

The embedded database is created at `DATABASE_PATH` (default `.data/emotionflix`) and `database/schema.sql` is applied automatically. Delete `.data/emotionflix` only when you intentionally want a clean local database.

The old Vercel demo used an in-memory snapshot. It cannot persist real accounts or user changes, so this version refuses that runtime. Private AWS infrastructure and managed PostgreSQL are provisioned; app upload is pending approval. See [current AWS status](docs/AWS_DEVELOPMENT_VERIFICATION.md) and [operations](infra/aws/README.md). The snapshot and seed commands remain explicit development tools.

## Production-style run

```bash
npm run build
npm start
```

The Express process serves both the built frontend and `/api` on port 3001. Put it behind HTTPS and keep `DATABASE_PATH` on persistent storage. A database lock rejects a second process targeting the same directory. Use one process for each embedded database; do not run multiple instances against the same directory. Production session cookies are Secure by default. For a local HTTP smoke test only, use `COOKIE_SECURE=false npm start`.

Passwords and recovery codes are hashed with scrypt. Session tokens are random, stored only in HttpOnly/SameSite cookies, and hashed in the database. Sign out revokes the session; password changes and recovery revoke every older session. State-changing API calls require `X-Moodie-Request: 1`. Authentication attempts are rate limited. Email addresses are login identifiers, not verified email-delivery endpoints.

Back up the persistent database directory while the process is stopped, or use a consistent PGlite dump. Keep backups private because diaries and optional photos live there. Test restoration before inviting real users. See [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md) for the verified flows and runtime boundary.

## Runtime model

- One root dependency install and lockfile
- One root `.env` file
- Local embedded PGlite by default, or an explicitly configured hosted PostgreSQL connection pool
- One development command
- One production process and origin
- Embedded schema initialization on startup; separate versioned migrations for hosted PostgreSQL

## Seed data

The application does not create demo or community content at startup. [`database/seed-contract.json`](./database/seed-contract.json) defines the seed contract. The seed script and verifier are explicit tasks.

```bash
npm run seed
npm run seed:verify
```

## Verification

```bash
npm run lint
npm run build
npm test
npm --workspace server test -- --runInBand
```

The product documents are source-of-truth constraints. When implementation and documentation differ, preserve user data and move the implementation toward the documented model deliberately.

## License and attribution

Moodie's source code is available under the [MIT License](./LICENSE).

Film metadata and artwork are supplied through the TMDB API. The API key remains on the Express server and is never sent to the browser. TMDB content is governed by TMDB's own terms and is not covered by the MIT License. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

The [architecture decision](docs/adr/0001-platform-data-and-ai-boundaries.md) records the researched language choice, data model, request patterns, AWS direction and model-independent AI boundary. Backend deployment target: AWS. The private development environment uses one ARM64 EC2 API host and managed RDS PostgreSQL. Application upload and live verification are pending; see [AWS development verification](docs/AWS_DEVELOPMENT_VERIFICATION.md). The embedded local database remains limited to one process per directory.


`npm run test:platform` runs a disposable cross-client continuity check using the real web services and Swift API client. It requires the Swift toolchain, uses an in-memory database and local test accounts, and removes its temporary files when finished. It does not touch the development database or deploy anything. Use `node scripts/verify-platform-continuity.mjs --review` after a build only when deliberately opening a disposable browser review; stop it with Ctrl-C. The normal command exits automatically.
