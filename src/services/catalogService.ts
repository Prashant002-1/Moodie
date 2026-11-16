import apiClient from './apiClient';
import { GenreResponse, Movie, MovieSearchResponse } from '../types/movie';

export const catalogService = {
  async trending(page = 1): Promise<MovieSearchResponse> {
    const response = await apiClient.get('/catalog/trending', { params: { page } });
    return response.data;
  },

  async popular(page = 1): Promise<MovieSearchResponse> {
    const response = await apiClient.get('/catalog/popular', { params: { page } });
    return response.data;
  },

  async search(query: string, page = 1, signal?: AbortSignal): Promise<MovieSearchResponse> {
    const response = await apiClient.get('/catalog/search', { params: { q: query, page }, signal });
    return response.data;
  },

  async genres(): Promise<GenreResponse> {
    const response = await apiClient.get('/catalog/genres');
    return response.data;
  },

  async movie(movieId: number, signal?: AbortSignal): Promise<Movie> {
    const response = await apiClient.get(`/catalog/movies/${movieId}`, { signal });
    return response.data;
  },

  async related(movieId: number, signal?: AbortSignal): Promise<Movie[]> {
    const response = await apiClient.get(`/catalog/movies/${movieId}/related`, { signal });
    return response.data.results;
  },
};
