/**
 * TMDB Service
 * 
 * Server-side service for interacting with The Movie Database (TMDB) API.
 * Provides movie data retrieval, search functionality, and movie details
 * for server-side operations and data enrichment.
 */

import axios from 'axios';
import pool from '../config/database';
import { env } from '../config/env';

const BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = env.tmdbApiKey;


/**
 * Pre-configured Axios client for TMDB API requests.
 * Includes base URL and API key authentication.
 */
const tmdbClient = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  params: {
    api_key: API_KEY,
  },
});

/**
 * Movie data structure from TMDB API.
 * Represents basic movie information used for server-side operations.
 */
export interface TMDBMovie {
  /** Unique TMDB movie identifier */
  id: number;
  /** Movie title */
  title: string;
  /** Movie description/plot summary */
  overview: string;
  /** Release date in YYYY-MM-DD format */
  release_date: string;
  /** Path to poster image (relative to TMDB base URL) */
  poster_path: string | null;
  /** Path to backdrop image (relative to TMDB base URL) */
  backdrop_path: string | null;
  /** Average user rating (0-10) */
  vote_average: number;
  /** Total number of votes */
  vote_count: number;
  /** TMDB popularity score */
  popularity: number;
  /** Array of TMDB genre IDs */
  genre_ids: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  tagline?: string;
  adult?: boolean;
  original_language?: string;
  original_title?: string;
  video?: boolean;
}

export interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

/**
 * Retrieves detailed information for a specific movie.
 * 
 * @param movieId - TMDB movie ID to fetch details for
 * @returns Promise resolving to movie details
 * @throws {Error} If movie not found or API request fails
 */
// Existing cached metadata remains usable when the catalog service is unavailable.
const cachedSelect = `SELECT m.*, m.release_date::text,
  COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name)) FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id = m.id), '[]') AS genres
  FROM movies m`;
const cachedMovie = (row: any): TMDBMovie => {
  const { tmdb_data, last_updated: _lastUpdated, ...metadata } = row;
  return { ...tmdb_data, ...metadata,
    genre_ids: row.genres.map((genre: { id: number }) => genre.id),
    vote_average: Number(row.vote_average) || 0, vote_count: Number(row.vote_count) || 0, popularity: Number(row.popularity) || 0,
  };
};
const cachedList = async (page = 1, query = '', excludeId = 0): Promise<TMDBResponse> => {
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const result = await pool.query(`${cachedSelect} WHERE m.title ILIKE $1 AND m.id <> $2 ORDER BY m.title, m.id LIMIT 20 OFFSET $3`, [pattern, excludeId, (page - 1) * 20]);
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM movies m WHERE m.title ILIKE $1 AND m.id <> $2', [pattern, excludeId]);
  return { page, results: result.rows.map(cachedMovie), total_pages: Math.ceil(count.rows[0].total / 20), total_results: count.rows[0].total };
};
const liveOrCached = async <T>(live: () => Promise<T>, cached: () => Promise<T>): Promise<T> => {
  if (!API_KEY || API_KEY === 'replace-with-your-tmdb-api-key') return cached();
  try { return await live(); } catch { return cached(); }
};
export const getMovieDetails = async (movieId: number): Promise<TMDBMovie> => {
  const cached = await pool.query(`${cachedSelect} WHERE m.id = $1`, [movieId]);
  if (cached.rowCount) return cachedMovie(cached.rows[0]);
  const response = await tmdbClient.get(`/movie/${movieId}`);
  const movie = response.data as TMDBMovie;
  if (!movie.genre_ids?.length && movie.genres) movie.genre_ids = movie.genres.map(genre => genre.id);
  return movie;
};
export const searchMovies = (query: string, page = 1): Promise<TMDBResponse> => liveOrCached(
  async () => (await tmdbClient.get('/search/movie', { params: { query, page, include_adult: false } })).data,
  () => cachedList(page, query),
);
export const getGenres = async (): Promise<{ genres: { id: number; name: string }[] }> => ({ genres: (await pool.query('SELECT id, name FROM genres ORDER BY name')).rows });
export const getTrendingMovies = (page = 1): Promise<TMDBResponse> => liveOrCached(
  async () => (await tmdbClient.get('/trending/movie/week', { params: { page } })).data,
  () => cachedList(page),
);
export const getPopularMovies = (page = 1): Promise<TMDBResponse> => liveOrCached(
  async () => (await tmdbClient.get('/movie/popular', { params: { page } })).data,
  () => cachedList(page),
);
export const getRelatedMovies = (movieId: number): Promise<TMDBResponse> => liveOrCached(
  async () => (await tmdbClient.get(`/movie/${movieId}/recommendations`)).data,
  async () => {
    const result = await pool.query(`${cachedSelect} WHERE m.id <> $1 AND EXISTS (SELECT 1 FROM movie_genres source JOIN movie_genres other ON other.genre_id = source.genre_id WHERE source.movie_id = $1 AND other.movie_id = m.id) ORDER BY m.title LIMIT 20`, [movieId]);
    return { page: 1, results: result.rows.map(cachedMovie), total_pages: result.rowCount ? 1 : 0, total_results: result.rowCount };
  },
);
