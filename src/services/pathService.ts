import apiClient from './apiClient';
import type { components } from '../types/generated/discovery';

type Schema = components['schemas'];
export type FilmForYou = Schema['FilmForYou'];
export type FilmPath = Schema['FilmPath'];
export type PathReason = FilmPath['reason'];
export type FilmsForYou = Schema['FilmsForYou'];
export type Introduction = Schema['Introduction'];
export type Recipient = Schema['Recipient'];
export type Recipients = Schema['Recipients'];
export type StarterFilm = Schema['Film'];

/** Discovery through people: films, people to meet, who to send a film to, and where a newcomer starts. */
export const pathService = {
  async films(params: { limit?: number; offset?: number } = {}, signal?: AbortSignal): Promise<FilmsForYou> {
    return (await apiClient.get('/discovery/for-you', { params, signal })).data;
  },
  async hide(movieId: number): Promise<void> { await apiClient.put(`/discovery/for-you/${movieId}/hidden`); },
  async unhide(movieId: number): Promise<void> { await apiClient.delete(`/discovery/for-you/${movieId}/hidden`); },
  async hidden(signal?: AbortSignal): Promise<StarterFilm[]> {
    return (await apiClient.get<Schema['StarterFilms']>('/discovery/for-you/hidden', { signal })).data.films;
  },
  async introductions(limit = 6, signal?: AbortSignal): Promise<Introduction[]> {
    return (await apiClient.get<Schema['Introductions']>('/discovery/introductions', { params: { limit }, signal })).data.people;
  },
  async recipients(movieId: number, q = '', signal?: AbortSignal): Promise<Recipients> {
    return (await apiClient.get('/discovery/recipients', { params: { movieId, q }, signal })).data;
  },
  async starter(limit = 18, signal?: AbortSignal): Promise<StarterFilm[]> {
    return (await apiClient.get<Schema['StarterFilms']>('/discovery/starter', { params: { limit }, signal })).data.films;
  },
};
