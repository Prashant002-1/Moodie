# Account release verification

October 1, 2026 AWS update: private infrastructure and hosted PostgreSQL are provisioned. Application upload and cloud runtime verification are pending; initial-dataset RDS snapshot restoration passed. See [current AWS evidence](AWS_DEVELOPMENT_VERIFICATION.md). The September record below describes earlier local verification.

Verified locally on September 14, 2026 with Node.js 22.22.3. This is a local implementation and verification record, not a deployment claim.

## Working journeys

| Journey | Verified behavior |
| --- | --- |
| Account access | Sign up, password confirmation, unique email/username, sign in with either identifier, restoration after reload, deep-link return, sign out |
| Recovery | Private recovery code shown after sign-up; recovery changes the password, rotates the code, and revokes older sessions |
| Account settings | Public bio, public-profile link, diary counts, password change, account deletion with password and UI confirmation |
| First response | Film search, selection, date, note, seven feelings, optional photo, private/public visibility, successful save, next recommendation |
| Failed save | Note and feeling controls remain intact; errors are shown; retry remains available |
| Diary | Complete history beyond the original fixed limit, search, visibility filters, rewatches, edit, photo removal, deletion, recent-feeling summary |
| Saved films | Save once, restore after restart, remove, open film, add response |
| People | New users are discoverable before posting; following, unfollowing, profile, followers, shared films, and public responses |
| Feed and activity | Public responses, chronological Following/Everyone, likes, comments, comment deletion, and older response links |
| Privacy | Cross-account writes rejected; private notes/photos absent from other users' feeds, profiles, film pages, comments, pulse, and recommendation explanations |
| Recommendations | Person and shared-film provenance, source response, desired feelings, watched-film exclusion, public-source requirement |
| Catalog | Later result pages are reachable; existing cached films work without a live provider; movies without artwork remain searchable and usable |
| Persistence | Sessions, diary, saved films, deletions, and logout revocation survive process restarts; consistent backup restores successfully |
| Database ownership | A second application process using the same database is rejected |
| Legacy import | Runs once; deleted legacy viewings and saved films do not return on restart |

## Evidence

- `npm run build`: frontend and backend production build passed.
- `npm run lint`: passed without warnings.
- `npm test`: 14 tests across 5 suites passed.
- `npm --workspace server test -- --runInBand`: 47 tests across 10 suites passed, using disposable in-memory databases.
- `npm run test:production`: passed against disposable persistent databases and the compiled Express server. Includes restarts, exclusive-access rejection, backup restoration, and durable deletion/revocation.
- Browser check against the production build: sign up, recovery-code acknowledgment, first private Whiplash response, person-led recommendation, recommended film details, save for later, own diary, reload, account, and sign out. No browser console warnings or errors were observed. Live TMDB access was disabled for this check. The temporary tab was closed.
- Learned mechanism: signup through an active learned model, exact response evidence, follow/feed/save/watch, privacy retraction, intensity preservation, 901 eligible candidate films, deterministic refits, and unchanged ordering after wording/photo edits passed.
- Catalog import: 86 bundled film records imported without importing sample accounts or responses.

## Local data and runtime

The existing `.data/emotionflix` database failed before the account migration could run, with an invalid checkpoint record at `0/1E52D00`. The original remains at its existing path. An untouched pre-start copy is saved at `.data/emotionflix-before-accounts-20260914`. A diagnostic copy reproduced the checkpoint failure. No old user records were replaced or deleted, and recovery of that damaged database is not claimed.

The local root `.env` now selects `.data/moodie-accounts`, a separate persistent database initialized with only the 86 bundled films. It starts with no sample people or responses. New accounts own their data. The updated app runs at `http://localhost:3001`; the existing RoomDex server on port 5173 was left alone.

## Deployment boundary

AWS was selected as the backend target on September 25. Service selection and deployment scope are deferred until the user shares available resources; see [platform alignment](PLATFORM_ALIGNMENT.md#storage-and-growth-boundary). No remote service was configured, and nothing was pushed or deployed. The previous Vercel function loads an in-memory demo snapshot and loses writes when its process goes away. This version rejects that runtime for real accounts. Deploy the single Express process with HTTPS and a persistent database directory, or deliberately replace that storage boundary later.

Production cookies are Secure by default. `COOKIE_SECURE=false` is used only for the local HTTP run. Configure an exact trusted proxy hop count only behind a controlled proxy. Keep the database and backups private. The embedded database supports one application process per directory, not multiple serverless instances. Large-community load testing and a public moderation workflow are outside this verified release; the existing product specification treats moderation as future work.

No email verification or email reset is claimed. Email identifies an account; password recovery uses the private code. Losing both the password and recovery code cannot be resolved by the current self-service flow.

## Repeat verification

```bash
npm run lint
npm run build
npm test
npm --workspace server test -- --runInBand
npm run test:production
```

`test:production` starts and stops its own local servers and removes its disposable databases. `catalog:import` is an explicit setup command, and requires that the target database is not in use by another application process. Startup does not populate sample social content.


## Learned discovery follow-up

The account implementation is now connected to `response-transfer-v1`, a locally trained response-transfer model with a validation gate. The previous hand-tuned recommendation weights and candidate truncations have been removed. Recommendations, the people directory and connected feed previews use the same shared-film evidence. Feed cursors preserve microsecond precision and remain stable while new posts arrive.

See [the model and evaluation contract](LEARNED_RECOMMENDATIONS.md) and [the generated benchmark](recommendation-evaluation.json). The demo and controlled test cohorts establish functional behavior, not real-user quality. No social seed data or trained demo model is imported into real accounts, and no hosting deployment is part of this work.
