# Moodie

Moodie is emotion-based social film discovery.

> Moodie uses the TMDB API for non-commercial purposes and is not endorsed or certified by TMDB.

[Open the live Moodie demo](https://moodie-server-mauve.vercel.app/)

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
- Express, embedded PostgreSQL via PGlite, JWT authentication, and Zod validation
- TMDB for server-side film metadata and artwork
- Vitest, React Testing Library, Jest, and Supertest

## Architecture

`React client → Express API → PGlite`

React and TypeScript handle the interface through one authenticated API client. Express groups catalog, diary, library, discovery, recommendation, and demo-session routes, and proxies TMDB so its key stays off the client. PGlite stores diary and social data. Vite proxies `/api` locally; Vercel serves the React build and rewrites `/api` to Express.

## Product routes

- `/`: public product overview
- `/feed`: signed-in response stream with personal film paths woven into it
- `/search`: film and people search with community and shared-film context
- `/people`: followed and discoverable people with shared-film context
- `/activity`: reactions, follows, and recent responses from people followed
- `/recommendations`: a contextual continuation reached from a personal film path, not primary navigation
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
- `POST /api/auth/demo`

## Run locally

Requirement: Node.js 20 through 25. Node.js 22 is the recommended local runtime. Docker and a system database are not needed.

```bash
npm install
cp .env.example .env
```

Add a TMDB API key to `.env` to enable live film metadata:

```dotenv
TMDB_API_KEY=your-tmdb-api-key
```

Populate the local social demo, then start the application:

```bash
npm run seed
npm run dev
```

Open `http://localhost:5173`. The root command runs the web app and API together. Vite proxies `/api` internally, so there is no frontend API URL to configure.

Choose `Enter demo` on the landing page. Moodie opens the prepared social world directly; there is no account creation or password login.

The embedded database is created at `.data/emotionflix` and `database/schema.sql` is applied automatically. Delete `.data/emotionflix` only when you intentionally want a clean local database.

Vercel loads the committed `database/demo-seed.tgz` snapshot instead of rebuilding the social world during a request. Run `npm run demo:snapshot` only when the deterministic demo data changes.

## Production-style run

```bash
npm run build
npm start
```

The Express process serves both the built frontend and `/api` from `http://localhost:3001`.

## Runtime model

- One root dependency install and lockfile
- One root `.env` file
- One embedded, persistent PostgreSQL-compatible database
- One development command
- One production process and origin
- Automatic schema initialization on startup

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
