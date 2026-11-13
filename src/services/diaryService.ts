import apiClient from './apiClient';
import { DiaryEntry, DiaryEntryChanges, DiaryEntryInput, DiarySummary, FilmLibraryState, SavedFilm } from '../types/diary';

export interface DiaryQuery { q?: string; visibility?: 'private' | 'public'; movieId?: number; limit?: number; offset?: number }
export interface DiaryPage { entries: DiaryEntry[]; nextOffset: number | null }

export const diaryService = {
  async page(params: DiaryQuery = {}, signal?: AbortSignal): Promise<DiaryPage> {
    return (await apiClient.get<DiaryPage>('/diary', { params, signal })).data;
  },
  async summary(signal?: AbortSignal): Promise<DiarySummary> {
    const response = await apiClient.get('/diary/summary', { signal });
    return response.data;
  },

  async create(input: DiaryEntryInput): Promise<DiaryEntry> {
    const response = await apiClient.post('/diary', input);
    return response.data.entry;
  },

  async update(entryId: number, changes: DiaryEntryChanges): Promise<DiaryEntry> {
    const response = await apiClient.patch(`/diary/${entryId}`, changes);
    return response.data.entry;
  },

  async remove(entryId: number): Promise<void> {
    await apiClient.delete(`/diary/${entryId}`);
  },

  async savedPage(params: Pick<DiaryQuery, 'q' | 'limit' | 'offset'> = {}, signal?: AbortSignal): Promise<{ films: SavedFilm[]; nextOffset: number | null }> {
    return (await apiClient.get('/library/saved', { params: { limit: 30, ...params }, signal })).data;
  },

  async status(movieIds: number[], signal?: AbortSignal): Promise<FilmLibraryState[]> {
    return (await apiClient.get('/library/status', { params: { movieIds: movieIds.join(',') }, signal })).data.films;
  },

  async save(movieId: number): Promise<void> {
    await apiClient.post('/library/saved', { movieId });
  },

  async unsave(movieId: number): Promise<void> {
    await apiClient.delete(`/library/saved/${movieId}`);
  },
};
