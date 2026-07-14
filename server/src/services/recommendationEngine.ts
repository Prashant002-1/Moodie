import pool from '../config/database';
import { TMDBMovie } from './tmdbService';

export const EMOTION_KEYS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'] as const;
export type EmotionKey = typeof EMOTION_KEYS[number];
export type EmotionScores = Record<EmotionKey, number>;

interface DiarySignalRow extends EmotionScores {
  movie_id: number;
  title: string;
}

export interface MatchedPerson {
  id: number;
  username: string;
  bio: string;
  similarity: number;
  sharedFilms: number;
  sharedFilmTitle: string;
}

export interface RecommendationConnection {
  id: number;
  username: string;
  similarity: number;
  shared_film_title: string;
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
  user_id: number;
  username: string;
  movie_id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  tmdb_data: TMDBMovie | null;
  created_at: string;
}

interface CandidateAccumulator {
  movie: SocialMovie;
  people: RecommendationConnection[];
  score: number;
  latest: number;
}

const normalizeScores = (scores: Partial<EmotionScores>): EmotionScores => {
  const total = EMOTION_KEYS.reduce((sum, key) => sum + Math.max(0, Number(scores[key]) || 0), 0);
  if (!total) return { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
  return Object.fromEntries(
    EMOTION_KEYS.map(key => [key, Math.max(0, Number(scores[key]) || 0) / total]),
  ) as EmotionScores;
};

const emotionalSimilarity = (left: Partial<EmotionScores>, right: Partial<EmotionScores>): number => {
  const a = normalizeScores(left);
  const b = normalizeScores(right);
  const distance = EMOTION_KEYS.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0);
  return Math.max(0, 1 - distance / 2);
};

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
     ORDER BY de.movie_id, de.watched_on DESC, de.created_at DESC`,
    [userId],
  );
  return result.rows;
};

const loadMatchedPeople = async (userId?: number): Promise<MatchedPerson[]> => {
  if (!userId) return [];
  const result = await pool.query(
    `WITH viewer_entries AS (
       SELECT DISTINCT ON (movie_id)
              movie_id, neutral, happy, sad, angry, fearful, disgusted, surprised
       FROM diary_entries
       WHERE user_id = $1
       ORDER BY movie_id, watched_on DESC, created_at DESC
     ), public_latest AS (
       SELECT DISTINCT ON (de.user_id, de.movie_id)
              de.user_id, de.movie_id, m.title,
              de.neutral, de.happy, de.sad, de.angry, de.fearful, de.disgusted, de.surprised
       FROM diary_entries de
       JOIN movies m ON m.id = de.movie_id
       WHERE de.visibility = 'public' AND de.user_id <> $1
       ORDER BY de.user_id, de.movie_id, de.watched_on DESC, de.created_at DESC
     ), comparisons AS (
       SELECT candidate.user_id, candidate.title,
              GREATEST(0, 1 - (
                ABS(candidate.neutral - viewer.neutral) + ABS(candidate.happy - viewer.happy) +
                ABS(candidate.sad - viewer.sad) + ABS(candidate.angry - viewer.angry) +
                ABS(candidate.fearful - viewer.fearful) + ABS(candidate.disgusted - viewer.disgusted) +
                ABS(candidate.surprised - viewer.surprised)
              ) / 7)::float AS similarity
       FROM public_latest candidate
       JOIN viewer_entries viewer ON viewer.movie_id = candidate.movie_id
     ), ranked AS (
       SELECT user_id, COUNT(*)::int AS shared_films, AVG(similarity)::float AS similarity,
              (ARRAY_AGG(title ORDER BY similarity DESC, title ASC))[1] AS shared_film_title
       FROM comparisons
       GROUP BY user_id
       HAVING COUNT(*) >= 2
     )
     SELECT u.id, u.username, u.bio, ranked.shared_films,
            ranked.similarity, ranked.shared_film_title
     FROM ranked
     JOIN users u ON u.id = ranked.user_id
     ORDER BY ranked.similarity DESC, ranked.shared_films DESC, u.username ASC
     LIMIT 12`,
    [userId],
  );
  return result.rows.map(row => ({
    id: Number(row.id),
    username: row.username,
    bio: row.bio || '',
    similarity: Number(Number(row.similarity).toFixed(3)),
    sharedFilms: Number(row.shared_films),
    sharedFilmTitle: row.shared_film_title,
  }));
};

const loadCandidateRows = async (userId: number | undefined, personIds?: number[]): Promise<CandidateRow[]> => {
  const values: unknown[] = [];
  const clauses = ["de.visibility = 'public'", 'm.poster_path IS NOT NULL'];
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
    `SELECT de.user_id, u.username, de.movie_id, de.created_at,
            de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
            de.fearful::float, de.disgusted::float, de.surprised::float,
            m.title, m.overview, m.release_date::text, m.poster_path, m.backdrop_path, m.tmdb_data
     FROM diary_entries de
     JOIN users u ON u.id = de.user_id
     JOIN movies m ON m.id = de.movie_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY de.created_at DESC
     LIMIT 240`,
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

  rows.forEach(row => {
    const person = matchById.get(Number(row.user_id));
    const signalFit = signal ? emotionalSimilarity(row, signal) : 0;
    const personScore = person?.similarity ?? 0.2;
    const connection: RecommendationConnection | null = person ? {
      id: person.id,
      username: person.username,
      similarity: person.similarity,
      shared_film_title: person.sharedFilmTitle,
    } : null;
    const existing = byMovie.get(Number(row.movie_id)) || {
      movie: asSocialMovie(row),
      people: [],
      score: 0,
      latest: 0,
    };
    if (connection && !existing.people.some(item => item.id === connection.id)) existing.people.push(connection);
    existing.score += personScore + signalFit * 0.25;
    existing.latest = Math.max(existing.latest, new Date(row.created_at).getTime() || 0);
    byMovie.set(Number(row.movie_id), existing);
  });

  return [...byMovie.values()]
    .sort((a, b) => b.score - a.score || b.people.length - a.people.length || b.latest - a.latest)
    .map(({ movie, people }) => {
      const lead = people[0];
      const recommendationReason = lead
        ? `They felt something similar about ${lead.shared_film_title}. This stayed with them too.`
        : 'Shared by someone in the community.';
      return {
        ...movie,
        recommendation_reason: recommendationReason,
        ...(people.length ? { recommended_by: people.slice(0, 4) } : {}),
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
  const source: RecommendationProfile['source'] = entries.length
    ? 'people'
    : signal
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
  const [matchedRows, communityRows] = await Promise.all([
    matchedIds.length ? loadCandidateRows(userId, matchedIds) : Promise.resolve([]),
    loadCandidateRows(userId),
  ]);
  const matched = rankCandidateRows(matchedRows, matchedPeople, signal);
  const community = rankCandidateRows(communityRows, matchedPeople, signal);
  const primary = matched.length ? matched : community;
  const primaryIds = new Set(primary.slice(0, 18).map(movie => movie.id));
  const adjacent = community.filter(movie => !primaryIds.has(movie.id)).slice(0, 14);

  return {
    profile,
    forYou: primary.slice(0, 18),
    adjacent: adjacent.length ? adjacent : primary.slice(6, 18),
    community: community.slice(0, 18),
    watchedCount: entries.length,
  };
};
