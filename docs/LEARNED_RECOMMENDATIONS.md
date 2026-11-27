# Learned recommendations and feed

> Status, 2026-11-27: the web app no longer ranks with this. It uses [discovery through people](DISCOVERY.md), which reads the verdict a person gave and the follows around the viewer; in simulated communities this model never gathers enough responses to switch on, and what remains ranks about as well as chance. `/api/recommendations` is unchanged and still serves the iPhone app. Everything below describes that endpoint.

Moodie learns how a viewer's response to a film differs from another person's response, using the films they previously shared. It recommends through actual public responses and preserves those response IDs as evidence. It does not learn a universal emotion label for a film.

The distinctive product mechanism is a complete loop: record a film and its feeling intensities, connect through shared films, predict how another person's response may transfer to the viewer, follow that response to a new film, then learn from the next saved response. This is a product implementation using established statistical methods, not a claim of a new research algorithm.

## Model and objective

`server/src/services/emotionalLearning.ts` implements multi-output regularized regression of seven later feeling intensities. The target is the viewer's actual saved response minus the source person's response on that film. The model learns 259 coefficients: seven outputs by 37 context features.

Features contain an intercept, seven mean intensity differences across shared films, seven mean absolute differences, seven source-film intensities, seven source-intensity/difference interactions, inverse shared-film support, and seven difference variances. The interaction terms let the correction depend on the new film's response instead of applying one constant correction to every film. IDs, titles, notes, photos, genres, ratings, likes, saves and popularity are not features. Values retain their absolute 0–1 intensities and are never normalized to a total of one.

Training examples simulate an actual discovery path. When a target response became available, the source must already have publicly responded to that film. Both people must have earlier responses to at least one other shared film. The target film is excluded from both histories. Equal-time records cannot predict each other. Each target viewing has total training weight one, regardless of how many peers create paths to it. Rewatches update context but do not manufacture extra independent shared films or first-viewing targets.

The current version's availability is the later of `signal_updated_at` and `published_at`. A database trigger updates these when feelings or viewing context change or a response becomes publicly eligible. Wording and photo edits preserve them. Backdating a viewing cannot make it available in the past. Older schemas are conservatively backfilled from `updated_at`. The database stores the current response version, so a revised feeling vector is absent from earlier training snapshots. This avoids reconstructing a historical vector that is no longer known.

The learner solves regularized normal equations using Cholesky decomposition. It selects regularization from 0.1, 1, 10 and 100 on later validation targets. It activates only if it improves validation MSE over all three baselines: copying the source, correcting with the mean shared-film offset, and the earlier public population mean. At least 30 usable targets, 20 training targets and 10 validation targets are required. This is a deployment gate, not statistical proof of generalization.

With insufficient evidence, or when validation prefers a baseline, status remains `collecting`. The app can still show a transparent connection from a shared film and its actual public response. It does not manufacture a trained model or substitute trending films for personal recommendations. The source response is the cold-start prediction, with a bounded-intensity uncertainty prior.

## Ranking and uncertainty

A personalized candidate requires a real public response by a person with a shared-film connection. At least one shared feeling must be visible in the shared-film evidence. Already watched films are excluded. All shared films contribute to the connection; disagreement weakens it. Stronger and weaker intensities remain distinguishable.

Each source path predicts a response vector. Its approximate uncertainty includes held-out residual error, regression leverage and disagreement in the finite shared history. With a requested feeling mix, the ranking objective is expected squared distance to that mix. Without an intent, it is expected squared distance to the cited person's response, favoring paths whose emotional response is likely to transfer. This does not assert that sadness means dislike or happiness means a good film.

A candidate's complete source paths are combined using precision-weighted expected loss. There is no hand-set strongest-person blend, response-strength boost, endorsement-count bonus, genre mapping or popularity term. Repeated identical endorsements cannot raise a film's score. Ties are deterministic. A feeling-intent path must include a requested feeling in the actual cited response.

The seven-dimensional predictive variance is an approximation, not a calibrated confidence percentage. Correlated peers and future changes in taste remain limitations. No compatibility percentage or predicted emotional certainty is shown in the interface.

The API returns all contributing source paths with the shared film ID, shared public response ID, recommended response ID, notes and recorded feelings. The UI's lead explanation uses the strongest contributing path. Links open the exact shared and recommended responses. Predicted values never replace what a person actually recorded.

## Privacy and updates

Only current public responses with a note and nonzero feelings enter the shared learner. A viewer's private responses are used only to build that viewer's context. Another viewer's private rows are not loaded. Photos and note text never alter model inputs.

Model input is hashed and cached in process memory. A public vector edit, visibility change, new response or deletion changes the input and causes a refit on the next read. Notes and profile text are read fresh for evidence. No learned model is bundled into account databases, and no private vector is persisted in a shared model. Restart rebuilds deterministically from the current public corpus. Inference and evidence use one database statement's snapshot.

`collecting` / `learning` and the model version are exposed under `profile.model`. Weights, private history and numerical compatibility scores are not returned. Changes to another person's private vector are covered by a test requiring byte-equivalent recommendations for the viewer.

## Feed and people

For You shows ranked films and complete responses from those film paths, with a different person in each preview slot when available. The people directory and member shared-film context use the same connection model. Following and Everyone remain explicitly chronological feeds. Following excludes people who are not followed.

Home refreshes recommendations when the diary or requested feelings change and when the window regains focus. Failed recommendations display a retry instead of silently presenting an empty state. The recommendations page does not leave stale results on screen after a failed refresh. Public feed pages use a timestamp-and-ID cursor with microsecond precision so a newly published response does not cause duplicates or skipped older responses. Films beyond the first 18 remain available on the recommendations page; the former 24-person and 800-source truncations are removed.

## Reproducible evaluation

Run `npm run recommendations:evaluate` with Node 22. It opens the committed demo snapshot in an isolated in-memory database and writes `docs/recommendation-evaluation.json`. It does not read account databases or call external services.

The benchmark uses a global temporal split. Model fitting and internal validation finish before the test period. Test response intensities are only labels. Earlier test-period publications can inform later test predictions, as in the live app. Ranking is separately evaluated at one frozen cutoff using only source responses available at that cutoff. Future self-reports supply relevance labels; unseen films without later labels are not invented negatives. Reported ranking regret measures feeling fit, not click-through, satisfaction or next-watch recall.

The controlled generator varies film affect, viewer intensity and offsets, viewing selection, publication delays and noise independently. It does not call the learner to produce its labels. Five fixed seeds provide regression coverage. A separate unrelated-feelings control checks that the activation gate does not mistake regression toward a population average for a learned personal connection.

The current bundled demo contains 104 eligible public responses, only nine usable training targets before the outer test cutoff, and four test targets. It is inadequate for a quality claim and stays in `collecting` mode. The account store starts without fabricated social data. Controlled cohorts demonstrate learning and ranking behavior; they are not evidence of real member satisfaction. Assess that with actual member responses after launch.

## Operational boundary

Training is local and needs no model provider or external emotion service. The current learner materializes the public corpus and its directed training paths in memory. Approximately 900 simulated responses train in under 100 ms on the development machine; that is not a capacity guarantee. As the corpus grows, measure memory and request latency before introducing a background training job. The current serving process is the existing persistent Express/PGlite application, with no Vercel deployment added.

The seven feeling keys are still the documented vocabulary scaffold. The learning feature contract is versioned as `response-transfer-v1`; expanding or reinterpreting the vocabulary requires a separate data migration and model version. This change preserves every historical feeling value.

## Method references

Regularized least squares and Bayesian linear-model uncertainty are established methods. The implementation is local TypeScript rather than an imported ML runtime. See the [scikit-learn Bayesian regression documentation](https://scikit-learn.org/stable/modules/linear_model.html#bayesian-regression) for the underlying statistical family.

The temporal evaluation and explicit distinction between offline metrics and user outcomes follow the concerns described in [Evaluating Recommender Systems](https://www.microsoft.com/en-us/research/publication/evaluating-recommender-systems/) and [A Critical Study on Data Leakage in Recommender System Offline Evaluation](https://arxiv.org/abs/2010.11060).
