import pool from '../config/database';
import { TMDBMovie } from './tmdbService';

export const EMOTION_KEYS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'] as const;
export type EmotionKey = typeof EMOTION_KEYS[number];
export type EmotionScores = Record<EmotionKey, number>;

interface DiarySignalRow extends EmotionScores {
  movie_id: number;
  title: string;
}

interface SharedFilmRow {
  id: number;
  username: string;
  bio: string;
  shared_film_title: string;
  viewer_shared_note: string;
  person_shared_note: string;
  viewer_neutral: number;
  viewer_happy: number;
  viewer_sad: number;
  viewer_angry: number;
  viewer_fearful: number;
  viewer_disgusted: number;
  viewer_surprised: number;
  person_neutral: number;
  person_happy: number;
  person_sad: number;
  person_angry: number;
  person_fearful: number;
  person_disgusted: number;
  person_surprised: number;
}

export interface MatchedPerson {
  id: number;
  username: string;
  bio: string;
  similarity: number;
  sharedFilms: number;
  sharedFilmTitle: string;
  sharedFeelings: EmotionKey[];
  viewerSharedNote: string;
  personSharedNote: string;
}

export interface RecommendationConnection {
  id: number;
  username: string;
  shared_film_title: string;
  shared_feelings: EmotionKey[];
  response_feelings: EmotionKey[];
  viewer_shared_note: string;
  person_shared_note: string;
  response_id: number;
  response_note: string;
}

export interface RecommendationProfile {
  source: 'people' | 'signal' | 'community';
  historySize: number;
  connectedPeople: number;
  dominantEmotions: { key: EmotionKey; weight: number }[];
}

export type SocialMovie = Omit<TMDBMovie, 'vote_average' | 'vote_count' | 'popularity'>;

export interface RankedMovie extends SocialMovie {
  recommendation_reason: string;
  recommended_by?: RecommendationConnection[];
}

interface CandidateRow extends EmotionScores {
  entry_id: number;
  user_id: number;
  username: string;
  movie_id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  tmdb_data: TMDBMovie | null;
  note: string;
  created_at: string;
}

interface CandidateAccumulator {
  movie: SocialMovie;
  people: Array<RecommendationConnection & { evidenceScore: number; connectionScore: number }>;
  latest: number;
}

const MIN_SHARED_FILM_SIMILARITY = 0.5;
const MIN_AVERAGE_SIMILARITY = 0.4;
const MIN_SHARED_FEELING_OVERLAP = 0.06;
const MIN_INTENT_SIMILARITY = 0.28;
const MAX_RECOMMENDATION_SOURCES = 3;

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number) => Number(value.toFixed(4));

const emotionTotal = (scores: Partial<EmotionScores>) => (
  EMOTION_KEYS.reduce((sum, key) => sum + clamp(Number(scores[key]) || 0), 0)
);

const normalizeScores = (scores: Partial<EmotionScores>): EmotionScores => {
  const total = emotionTotal(scores);
  if (!total) return { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
  return Object.fromEntries(
    EMOTION_KEYS.map(key => [key, clamp(Number(scores[key]) || 0) / total]),
  ) as EmotionScores;
};

const emotionalSimilarity = (left: Partial<EmotionScores>, right: Partial<EmotionScores>): number => {
  if (!emotionTotal(left) || !emotionTotal(right)) return 0;
  const a = normalizeScores(left);
  const b = normalizeScores(right);
  const distance = EMOTION_KEYS.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0);
  return round(Math.max(0, 1 - distance / 2));
};

const topFeelings = (scores: Partial<EmotionScores>, limit = 3): EmotionKey[] => {
  const normalized = normalizeScores(scores);
  return EMOTION_KEYS
    .map(key => ({ key, value: normalized[key] }))
    .filter(item => item.value >= 0.06)
    .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key))
    .slice(0, limit)
    .map(item => item.key);
};

const sharedFeelings = (viewer: Partial<EmotionScores>, person: Partial<EmotionScores>): EmotionKey[] => {
  const viewerScores = normalizeScores(viewer);
  const personScores = normalizeScores(person);
  return EMOTION_KEYS
    .map(key => ({ key, overlap: Math.min(viewerScores[key], personScores[key]) }))
    .filter(item => item.overlap >= MIN_SHARED_FEELING_OVERLAP)
    .sort((left, right) => right.overlap - left.overlap || left.key.localeCompare(right.key))
    .slice(0, 3)
    .map(item => item.key);
};

const responseStrength = (scores: Partial<EmotionScores>) => (
  Math.max(...EMOTION_KEYS.map(key => clamp(Number(scores[key]) || 0)))
);

const asSocialMovie = (row: CandidateRow): SocialMovie => {
  const movie = row.tmdb_data || ({} as TMDBMovie);
  return {
    id: row.movie_id,
    title: row.title,
    overview: row.overview || movie.overview || '',
    release_date: row.release_date || movie.release_date || '',
    poster_path: row.poster_path ?? movie.poster_path ?? null,
    backdrop_path: row.backdrop_path ?? movie.backdrop_path ?? null,
    genre_ids: movie.genre_ids || movie.genres?.map(genre => genre.id) || [],
    genres: movie.genres,
    runtime: movie.runtime,
    tagline: movie.tagline,
    adult: movie.adult,
    original_language: movie.original_language,
    original_title: movie.original_title,
    video: movie.video,
  };
};

const loadDiarySignals = async (userId?: number): Promise<DiarySignalRow[]> => {
  if (!userId) return [];
  const result = await pool.query(
    `SELECT DISTINCT ON (de.movie_id) de.movie_id, m.title,
            de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
            de.fearful::float, de.disgusted::float, de.surprised::float
     FROM diary_entries de
     JOIN movies m ON m.id = de.movie_id
     WHERE de.user_id = $1
     ORDER BY de.movie_id, de.watched_on DESC, de.created_at DESC, de.id DESC`,
    [userId],
  );
  return result.rows;
};

const loadMatchedPeople = async (userId?: number): Promise<MatchedPerson[]> => {
  if (!userId) return [];
  const result = await pool.query(
    `WITH viewer_entries AS (
       SELECT DISTINCT ON (movie_id)
              movie_id, note, neutral, happy, sad, angry, fearful, disgusted, surprised
       FROM diary_entries
       WHERE user_id = $1
       ORDER BY movie_id, watched_on DESC, created_at DESC, id DESC
     ), public_latest AS (
       SELECT DISTINCT ON (de.user_id, de.movie_id)
              de.user_id, de.movie_id, m.title, de.note,
              de.neutral, de.happy, de.sad, de.angry, de.fearful, de.disgusted, de.surprised
       FROM diary_entries de
       JOIN movies m ON m.id = de.movie_id
       WHERE de.visibility = 'public' AND de.user_id <> $1 AND char_length(trim(de.note)) > 0
       ORDER BY de.user_id, de.movie_id, de.watched_on DESC, de.created_at DESC, de.id DESC
     ), comparisons AS (
       SELECT candidate.user_id, candidate.title,
              candidate.note AS person_shared_note, viewer.note AS viewer_shared_note,
              candidate.neutral AS person_neutral, candidate.happy AS person_happy,
              candidate.sad AS person_sad, candidate.angry AS person_angry,
              candidate.fearful AS person_fearful, candidate.disgusted AS person_disgusted,
              candidate.surprised AS person_surprised,
              viewer.neutral AS viewer_neutral, viewer.happy AS viewer_happy,
              viewer.sad AS viewer_sad, viewer.angry AS viewer_angry,
              viewer.fearful AS viewer_fearful, viewer.disgusted AS viewer_disgusted,
              viewer.surprised AS viewer_surprised
       FROM public_latest candidate
       JOIN viewer_entries viewer ON viewer.movie_id = candidate.movie_id
     )
     SELECT u.id, u.username, u.bio,
            comparisons.title AS shared_film_title,
            comparisons.viewer_shared_note, comparisons.person_shared_note,
            comparisons.viewer_neutral, comparisons.viewer_happy, comparisons.viewer_sad,
            comparisons.viewer_angry, comparisons.viewer_fearful, comparisons.viewer_disgusted,
            comparisons.viewer_surprised, comparisons.person_neutral, comparisons.person_happy,
            comparisons.person_sad, comparisons.person_angry, comparisons.person_fearful,
            comparisons.person_disgusted, comparisons.person_surprised
     FROM comparisons
     JOIN users u ON u.id = comparisons.user_id
     ORDER BY u.username ASC, comparisons.title ASC`,
    [userId],
  );
  const matches = new Map<number, Array<MatchedPerson & { sharedSimilarity: number }>>();

  (result.rows as SharedFilmRow[]).forEach(row => {
    const viewerSignals: EmotionScores = {
      neutral: Number(row.viewer_neutral) || 0,
      happy: Number(row.viewer_happy) || 0,
      sad: Number(row.viewer_sad) || 0,
      angry: Number(row.viewer_angry) || 0,
      fearful: Number(row.viewer_fearful) || 0,
      disgusted: Number(row.viewer_disgusted) || 0,
      surprised: Number(row.viewer_surprised) || 0,
    };
    const personSignals: EmotionScores = {
      neutral: Number(row.person_neutral) || 0,
      happy: Number(row.person_happy) || 0,
      sad: Number(row.person_sad) || 0,
      angry: Number(row.person_angry) || 0,
      fearful: Number(row.person_fearful) || 0,
      disgusted: Number(row.person_disgusted) || 0,
      surprised: Number(row.person_surprised) || 0,
    };
    const feelings = sharedFeelings(viewerSignals, personSignals);
    const similarity = emotionalSimilarity(viewerSignals, personSignals);
    const person: MatchedPerson & { sharedSimilarity: number } = {
      id: Number(row.id),
      username: row.username,
      bio: row.bio || '',
      similarity: Number(similarity.toFixed(3)),
      sharedSimilarity: similarity,
      sharedFilms: 1,
      sharedFilmTitle: row.shared_film_title,
      sharedFeelings: feelings,
      viewerSharedNote: row.viewer_shared_note || '',
      personSharedNote: row.person_shared_note || '',
    };
    const existing = matches.get(person.id) || [];
    existing.push(person);
    matches.set(person.id, existing);
  });

  return [...matches.values()]
    .map((shared): MatchedPerson | null => {
      const ordered = [...shared].sort((left, right) =>
        right.sharedSimilarity - left.sharedSimilarity
        || right.sharedFeelings.length - left.sharedFeelings.length
        || left.sharedFilmTitle.localeCompare(right.sharedFilmTitle),
      );
      const meaningful = ordered.filter(item => (
        item.sharedSimilarity >= MIN_SHARED_FILM_SIMILARITY
        && item.sharedFeelings.length > 0
      ));
      if (!meaningful.length) return null;
      const average = ordered.reduce((total, item) => total + item.sharedSimilarity, 0) / ordered.length;
      if (average < MIN_AVERAGE_SIMILARITY) return null;
      const strongest = meaningful[0];
      const repeatBonus = Math.min(0.09, Math.log2(meaningful.length) * 0.045);
      const connectionScore = Math.min(
        1,
        strongest.sharedSimilarity * 0.55 + average * 0.35 + repeatBonus,
      );
      return {
        id: strongest.id,
        username: strongest.username,
        bio: strongest.bio,
        sharedFilms: ordered.length,
        similarity: round(connectionScore),
        sharedFilmTitle: strongest.sharedFilmTitle,
        sharedFeelings: strongest.sharedFeelings,
        viewerSharedNote: strongest.viewerSharedNote,
        personSharedNote: strongest.personSharedNote,
      } satisfies MatchedPerson;
    })
    .filter((person): person is MatchedPerson => person !== null)
    .sort((left, right) => right.similarity - left.similarity || right.sharedFilms - left.sharedFilms || left.username.localeCompare(right.username))
    .slice(0, 24);
};

const loadCandidateRows = async (userId: number | undefined, personIds?: number[]): Promise<CandidateRow[]> => {
  const values: unknown[] = [];
  const clauses = ['m.poster_path IS NOT NULL', "char_length(trim(de.note)) > 0"];
  if (userId) {
    values.push(userId);
    clauses.push(`de.movie_id NOT IN (SELECT movie_id FROM diary_entries WHERE user_id = $${values.length})`);
    clauses.push(`de.user_id <> $${values.length}`);
  }
  if (personIds?.length) {
    values.push(personIds);
    clauses.push(`de.user_id = ANY($${values.length}::int[])`);
  }
  const result = await pool.query(
    `WITH public_latest AS (
       SELECT DISTINCT ON (source.user_id, source.movie_id) source.*
       FROM diary_entries source
       WHERE source.visibility = 'public'
       ORDER BY source.user_id, source.movie_id, source.watched_on DESC, source.created_at DESC, source.id DESC
     )
     SELECT de.id AS entry_id, de.user_id, u.username, de.movie_id, de.note, de.created_at,
            de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
            de.fearful::float, de.disgusted::float, de.surprised::float,
            m.title, m.overview, m.release_date::text, m.poster_path, m.backdrop_path, m.tmdb_data
     FROM public_latest de
     JOIN users u ON u.id = de.user_id
     JOIN movies m ON m.id = de.movie_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY de.watched_on DESC, de.created_at DESC, de.id DESC
     LIMIT 800`,
    values,
  );
  return result.rows;
};

const rankCandidateRows = (
  rows: CandidateRow[],
  matchedPeople: MatchedPerson[],
  signal?: Partial<EmotionScores>,
): RankedMovie[] => {
  const matchById = new Map(matchedPeople.map(person => [person.id, person]));
  const byMovie = new Map<number, CandidateAccumulator>();
  const hasSignal = Boolean(signal && emotionTotal(signal));

  rows.forEach(row => {
    if (!emotionTotal(row)) return;
    const person = matchById.get(Number(row.user_id));
    const signalFit = hasSignal ? emotionalSimilarity(row, signal || {}) : 0;
    if (hasSignal && signalFit < MIN_INTENT_SIMILARITY) return;
    const connection = person ? {
      id: person.id,
      username: person.username,
      shared_film_title: person.sharedFilmTitle,
      shared_feelings: person.sharedFeelings,
      response_feelings: topFeelings(row),
      viewer_shared_note: person.viewerSharedNote,
      person_shared_note: person.personSharedNote,
      response_id: Number(row.entry_id),
      response_note: row.note || '',
      connectionScore: person.similarity,
      evidenceScore: round(hasSignal
        ? person.similarity * 0.52 + signalFit * 0.43 + responseStrength(row) * 0.05
        : person.similarity * 0.9 + responseStrength(row) * 0.1),
    } : null;
    if (matchedPeople.length && !connection) return;
    const existing = byMovie.get(Number(row.movie_id)) || {
      movie: asSocialMovie(row),
      people: [],
      latest: 0,
    };
    if (connection && !existing.people.some(item => item.id === connection.id)) existing.people.push(connection);
    existing.latest = Math.max(existing.latest, new Date(row.created_at).getTime() || 0);
    byMovie.set(Number(row.movie_id), existing);
  });

  return [...byMovie.values()]
    .map(({ movie, people, latest }) => {
      const ordered = [...people].sort((left, right) => (
        right.evidenceScore - left.evidenceScore
        || right.connectionScore - left.connectionScore
        || left.username.localeCompare(right.username)
      ));
      const corroborationBonus = Math.min(0.075, Math.max(0, ordered.length - 1) * 0.025);
      const score = ordered.length ? ordered[0].evidenceScore + corroborationBonus : latest;
      const publicConnections: RecommendationConnection[] = ordered
        .slice(0, MAX_RECOMMENDATION_SOURCES)
        .map(source => ({
          id: source.id,
          username: source.username,
          shared_film_title: source.shared_film_title,
          shared_feelings: source.shared_feelings,
          response_feelings: source.response_feelings,
          viewer_shared_note: source.viewer_shared_note,
          person_shared_note: source.person_shared_note,
          response_id: source.response_id,
          response_note: source.response_note,
        }));
      return { movie, people: publicConnections, score, latest };
    })
    .sort((a, b) =>
      b.score - a.score
      || b.people.length - a.people.length
      || b.latest - a.latest
      || a.movie.title.localeCompare(b.movie.title),
    )
    .map(({ movie, people }) => {
      const lead = people[0];
      const recommendationReason = lead
        ? `Connected through @${lead.username} after ${lead.shared_film_title}.`
        : 'From a public response.';
      return {
        ...movie,
        recommendation_reason: recommendationReason,
        ...(people.length ? { recommended_by: people } : {}),
      };
    });
};

const dominantEmotions = (entries: DiarySignalRow[], signal?: Partial<EmotionScores>) => {
  const totals: EmotionScores = { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
  entries.forEach(entry => {
    const normalized = normalizeScores(entry);
    EMOTION_KEYS.forEach(key => { totals[key] += normalized[key]; });
  });
  if (signal) {
    const normalized = normalizeScores(signal);
    EMOTION_KEYS.forEach(key => { totals[key] += normalized[key]; });
  }
  const sum = EMOTION_KEYS.reduce((total, key) => total + totals[key], 0) || 1;
  return EMOTION_KEYS
    .map(key => ({ key, weight: Number((totals[key] / sum).toFixed(3)) }))
    .filter(item => item.weight > 0.04)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
};

export const buildRecommendationProfile = async (userId?: number, signal?: Partial<EmotionScores>) => {
  const [entries, matchedPeople] = await Promise.all([
    loadDiarySignals(userId),
    loadMatchedPeople(userId),
  ]);
  const hasSignal = Boolean(signal && emotionTotal(signal));
  const source: RecommendationProfile['source'] = matchedPeople.length
    ? 'people'
    : hasSignal
      ? 'signal'
      : 'community';
  return {
    entries,
    matchedPeople,
    profile: {
      source,
      historySize: entries.length,
      connectedPeople: matchedPeople.length,
      dominantEmotions: dominantEmotions(entries, signal),
    } satisfies RecommendationProfile,
  };
};

export const recommend = async (userId?: number, signal?: Partial<EmotionScores>) => {
  const { entries, matchedPeople, profile } = await buildRecommendationProfile(userId, signal);
  const matchedIds = matchedPeople.map(person => person.id);
  const matchedRows = matchedIds.length ? await loadCandidateRows(userId, matchedIds) : [];
  const matched = rankCandidateRows(matchedRows, matchedPeople, signal);
  const forYou = matched.slice(0, 18);
  const forYouIds = new Set(forYou.map(movie => movie.id));
  const adjacent = matched.slice(18, 32);
  const adjacentIds = new Set(adjacent.map(movie => movie.id));
  // Never mix an anonymous public response into a personalized path. When
  // there is a match, this final rail is still made from connected people. A
  // generic community list exists only for a true cold start.
  const community = matchedPeople.length
    ? matched.filter(movie => !forYouIds.has(movie.id) && !adjacentIds.has(movie.id)).slice(0, 18)
    : rankCandidateRows(await loadCandidateRows(userId), []).slice(0, 18);

  return {
    profile,
    forYou,
    adjacent,
    community,
    watchedCount: entries.length,
  };
};
