import { visibleResponse } from './communitySafety';
import { createHash } from 'crypto';
import pool from '../config/database';
import { TMDBMovie } from './tmdbService';
import {
  EMOTION_KEYS, EmotionKey, EmotionScores, LearningResponse, SharedResponse, TransferModel,
  aggregatePathLoss, expectedLoss, mse, predictTransfer, trainTransferModel, vector,
} from './emotionalLearning';
export { EMOTION_KEYS, EmotionKey, EmotionScores } from './emotionalLearning';

export interface MatchedPerson {
  id: number; username: string; bio: string; similarity: number; sharedFilms: number;
  sharedFilmTitle: string; sharedFeelings: EmotionKey[]; viewerSharedNote: string; personSharedNote: string;
  sharedResponseId: number; sharedMovieId: number;
  viewerSharedFeelings: EmotionScores; personSharedFeelings: EmotionScores;
}
export interface RecommendationConnection {
  id: number; username: string; shared_film_title: string; shared_feelings: EmotionKey[];
  response_feelings: EmotionKey[]; viewer_shared_note: string; person_shared_note: string;
  response_id: number; response_note: string; shared_response_id: number; shared_movie_id: number;
  viewer_shared_feelings: EmotionScores; person_shared_feelings: EmotionScores;
}
export interface RecommendationProfile {
  source: 'people' | 'signal' | 'community'; historySize: number; connectedPeople: number;
  dominantEmotions: { key: EmotionKey; weight: number }[];
  model: { version: string; status: 'learning' | 'collecting' };
}
export type SocialMovie = Omit<TMDBMovie, 'vote_average' | 'vote_count' | 'popularity'>;
export interface RankedMovie extends SocialMovie {
  recommendation_reason: string; recommended_by?: RecommendationConnection[];
}
interface ResponseRow extends EmotionScores {
  entry_id: number; user_id: number; username: string; bio: string; movie_id: number;
  title: string; overview: string; release_date: string; poster_path: string | null;
  backdrop_path: string | null; tmdb_data: TMDBMovie | null; note: string;
  created_at: string; signal_updated_at: string; published_at: string | null; watched_on: string; visibility: 'public' | 'private';
}
interface Peer extends MatchedPerson { shared: SharedResponse[] }
const total = (r: Partial<EmotionScores>) => vector(r).reduce((s, x) => s + x, 0);
export const topFeelings = (r: Partial<EmotionScores>): EmotionKey[] => EMOTION_KEYS
  .filter(k => Number(r[k]) >= 0.06)
  .sort((a, b) => Number(r[b]) - Number(r[a]) || a.localeCompare(b)).slice(0, 3);
const commonFeelings = (a: Partial<EmotionScores>, b: Partial<EmotionScores>) => EMOTION_KEYS
  .filter(k => Math.min(Number(a[k]), Number(b[k])) >= 0.06)
  .sort((x, y) => Math.min(Number(a[y]), Number(b[y])) - Math.min(Number(a[x]), Number(b[x])) || x.localeCompare(y)).slice(0, 3);
const asLearning = (r: ResponseRow): LearningResponse => ({
  id: Number(r.entry_id), userId: Number(r.user_id), movieId: Number(r.movie_id), values: vector(r),
  availableAt: Math.max(new Date(r.signal_updated_at).getTime(), new Date(r.published_at || r.created_at).getTime()),
  watchedAt: new Date(r.watched_on).getTime(),
});
function latest(rows: ResponseRow[]): ResponseRow[] {
  const map = new Map<string, ResponseRow>();
  [...rows].sort((a, b) => new Date(b.watched_on).getTime() - new Date(a.watched_on).getTime()
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || Number(b.entry_id) - Number(a.entry_id))
    .forEach(r => { const k = `${r.user_id}/${r.movie_id}`; if (!map.has(k)) map.set(k, r); });
  return [...map.values()];
}
let cached: { key: string; model: TransferModel } | undefined;
export function modelForResponses(responses: LearningResponse[]): TransferModel {
  const key = createHash('sha256').update(JSON.stringify(responses)).digest('hex');
  if (cached?.key !== key) cached = { key, model: trainTransferModel(responses) };
  return cached.model;
}

async function loadContext(userId?: number) {
  // One statement gives privacy, source provenance and model input the same DB
  // snapshot. Private rows are removed BEFORE constructing the shared learner.
  const result = await pool.query(`SELECT de.id AS entry_id, de.user_id, de.movie_id, de.note,
    de.created_at, de.signal_updated_at, de.published_at, de.watched_on, de.visibility,
    de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
    de.fearful::float, de.disgusted::float, de.surprised::float,
    u.username, u.bio, m.title, m.overview, m.release_date::text, m.poster_path, m.backdrop_path, m.tmdb_data
    FROM diary_entries de JOIN users u ON u.id = de.user_id JOIN movies m ON m.id = de.movie_id
    WHERE (de.visibility = 'public' OR de.user_id = $1) AND ${visibleResponse('$1')} ORDER BY de.id`, [userId || null]);
  const rows = result.rows as ResponseRow[];
  const publicRows = rows.filter(r => r.visibility === 'public' && r.note.trim() && total(r));
  const model = modelForResponses(publicRows.map(asLearning));
  const viewerRows = latest(rows.filter(r => Number(r.user_id) === userId));
  const viewer = new Map(viewerRows.map(r => [Number(r.movie_id), r]));
  const publicLatest = latest(publicRows).filter(r => Number(r.user_id) !== userId);
  const byPerson = new Map<number, ResponseRow[]>();
  publicLatest.forEach(r => { const group = byPerson.get(Number(r.user_id)) || []; group.push(r); byPerson.set(Number(r.user_id), group); });
  const matchedPeople: Peer[] = [];
  for (const [id, personRows] of byPerson) {
    const pairs = personRows.flatMap(p => {
      const v = viewer.get(Number(p.movie_id));
      return v && total(v) ? [{ viewer: v, person: p }] : [];
    });
    const evidence = pairs.filter(p => commonFeelings(p.viewer, p.person).length)
      .sort((a, b) => mse(vector(a.viewer), vector(a.person)) - mse(vector(b.viewer), vector(b.person))
        || Number(a.person.entry_id) - Number(b.person.entry_id))[0];
    if (!evidence) continue;
    const shared = pairs.map(p => ({ viewer: asLearning(p.viewer), person: asLearning(p.person) }));
    const disagreement = shared.reduce((s, p) => s + mse(p.viewer.values, p.person.values), 0);
    const prior = model.noise.reduce((s, x) => s + x, 0) / 7;
    const error = (prior + disagreement) / (shared.length + 1);
    matchedPeople.push({ id, username: evidence.person.username, bio: evidence.person.bio || '',
      similarity: 1 / (1 + error), sharedFilms: shared.length, sharedFilmTitle: evidence.person.title,
      sharedFeelings: commonFeelings(evidence.viewer, evidence.person), viewerSharedNote: evidence.viewer.note,
      personSharedNote: evidence.person.note, sharedResponseId: Number(evidence.person.entry_id),
      sharedMovieId: Number(evidence.person.movie_id),
      viewerSharedFeelings: Object.fromEntries(EMOTION_KEYS.map(key => [key, Number(evidence.viewer[key])])) as EmotionScores,
      personSharedFeelings: Object.fromEntries(EMOTION_KEYS.map(key => [key, Number(evidence.person[key])])) as EmotionScores,
      shared });
  }
  matchedPeople.sort((a, b) => b.similarity - a.similarity || a.username.localeCompare(b.username));
  return { entries: viewerRows, viewer, publicLatest, model, matchedPeople };
}
const asSocialMovie = (r: ResponseRow): SocialMovie => {
  const m = r.tmdb_data || ({} as TMDBMovie);
  return { id: Number(r.movie_id), title: r.title, overview: r.overview || '', release_date: r.release_date || '',
    poster_path: r.poster_path, backdrop_path: r.backdrop_path, genre_ids: m.genre_ids || m.genres?.map(g => g.id) || [],
    genres: m.genres, runtime: m.runtime, tagline: m.tagline, adult: m.adult,
    original_language: m.original_language, original_title: m.original_title, video: m.video };
};
function profileFor(context: Awaited<ReturnType<typeof loadContext>>, signal?: Partial<EmotionScores>): RecommendationProfile {
  const inputs = context.entries.length ? context.entries : signal ? [signal] : [];
  const totals = EMOTION_KEYS.map(key => ({ key, weight: inputs.reduce((s, r) => s + Number(r[key] || 0), 0) / Math.max(1, inputs.length) }));
  return { source: context.matchedPeople.length ? 'people' : signal && total(signal) ? 'signal' : 'community',
    historySize: context.entries.length, connectedPeople: context.matchedPeople.length,
    dominantEmotions: totals.filter(t => t.weight > 0.04).sort((a, b) => b.weight - a.weight).slice(0, 3),
    model: { version: context.model.version, status: context.model.status } };
}
export async function buildRecommendationProfile(userId?: number, signal?: Partial<EmotionScores>) {
  const c = await loadContext(userId);
  return { entries: c.entries, matchedPeople: c.matchedPeople.map(({ shared: _shared, ...p }) => p), profile: profileFor(c, signal) };
}
export async function recommend(userId?: number, signal?: Partial<EmotionScores>) {
  const c = await loadContext(userId), hasIntent = Boolean(signal && total(signal));
  const peers = new Map(c.matchedPeople.map(p => [p.id, p]));
  const byMovie = new Map<number, { row: ResponseRow; paths: { source: RecommendationConnection; loss: number; variance: number }[] }>();
  const community = new Map<number, ResponseRow>();
  for (const r of c.publicLatest) {
    if (c.viewer.has(Number(r.movie_id))) continue;
    const previous = community.get(Number(r.movie_id));
    if (!previous || new Date(r.created_at) > new Date(previous.created_at)) community.set(Number(r.movie_id), r);
    const p = peers.get(Number(r.user_id));
    if (!p) continue;
    // A feeling-intent explanation must have that feeling in the cited response.
    if (hasIntent && !commonFeelings(r, signal!).length) continue;
    const prediction = predictTransfer(c.model, p.shared, vector(r));
    const loss = expectedLoss(prediction, hasIntent ? vector(signal!) : vector(r));
    const group = byMovie.get(Number(r.movie_id)) || { row: r, paths: [] };
    group.paths.push({ loss, variance: prediction.variance.reduce((s, v) => s + v, 0) / 7, source: { id: p.id, username: p.username, shared_film_title: p.sharedFilmTitle,
      shared_feelings: p.sharedFeelings, response_feelings: topFeelings(r), viewer_shared_note: p.viewerSharedNote,
      person_shared_note: p.personSharedNote, response_id: Number(r.entry_id), response_note: r.note,
      shared_response_id: p.sharedResponseId, shared_movie_id: p.sharedMovieId,
      viewer_shared_feelings: p.viewerSharedFeelings, person_shared_feelings: p.personSharedFeelings } });
    byMovie.set(Number(r.movie_id), group);
  }
  const ranked = [...byMovie.values()].map(({ row, paths }) => {
    paths.sort((a, b) => a.loss - b.loss || a.source.username.localeCompare(b.source.username));
    // Every scored path is returned. A secondary explanation is never decorative.
    // Precision-weighted expected loss cannot create a popularity/count bonus.
    const loss = aggregatePathLoss(paths);
    return { row, paths, loss };
  }).sort((a, b) => a.loss - b.loss || a.row.title.localeCompare(b.row.title) || Number(a.row.movie_id) - Number(b.row.movie_id));
  const movies: RankedMovie[] = ranked.map(({ row, paths }) => ({ ...asSocialMovie(row),
    recommendation_reason: `Connected through @${paths[0].source.username} after ${paths[0].source.shared_film_title}.`,
    recommended_by: paths.map(p => p.source) }));
  return { profile: profileFor(c, signal), forYou: movies.slice(0, 18), adjacent: movies.slice(18),
    // Community is genuinely community, always separate from personalized paths.
    community: [...community.values()].filter(r => !byMovie.has(Number(r.movie_id)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || Number(b.entry_id) - Number(a.entry_id))
      .slice(0, 18).map((r): RankedMovie => ({ ...asSocialMovie(r), recommendation_reason: 'From a public response.' })),
    watchedCount: c.entries.length };
}
