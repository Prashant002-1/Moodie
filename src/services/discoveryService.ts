import apiClient from './apiClient';
import type { components as LibraryContract } from '../types/generated/library';
import type { components as SocialContract } from '../types/generated/social';

export type CommunityEntry = SocialContract['schemas']['CommunityEntry'];

export type ResponseEntry = Omit<CommunityEntry, 'bio' | 'following'> & Partial<Pick<CommunityEntry, 'bio' | 'following'>>;
export type SharedFilm = LibraryContract['schemas']['SharedFilm'];

export type CommunityPerson = SocialContract['schemas']['CommunityPerson'];

export type MemberProfile = SocialContract['schemas']['MemberProfile'];
export type MemberConnection = SocialContract['schemas']['MemberConnection'];

export type ActivityEvent = SocialContract['schemas']['ActivityEvent'];
export type ActivityFilter = 'all' | ActivityEvent['kind'] | 'recommendations';

export type EntryComment = SocialContract['schemas']['EntryComment'];

export interface CommunityFilm {
  movie_id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  response_count: number;
  people_count: number;
  latest_at: string;
  latest_username: string;
  latest_note: string | null;
}

export const discoveryService = {
  async feedPage(params: { limit?: number; scope?: 'everyone' | 'following'; cursor?: string; kind?: 'all' | 'written' } = {}, signal?: AbortSignal): Promise<{ entries: CommunityEntry[]; nextCursor: string | null }> {
    return (await apiClient.get('/discovery/feed', { params, signal })).data;
  },
  async sharedFilms(username: string, offset?: number, signal?: AbortSignal): Promise<{ films: SharedFilm[]; nextOffset: number | null }> {
    return (await apiClient.get(`/discovery/people/${encodeURIComponent(username)}/shared`, { params: { limit: 30, offset }, signal })).data;
  },
  async response(id: number, signal?: AbortSignal): Promise<ResponseEntry> {
    return (await apiClient.get<{ entry: ResponseEntry }>(`/discovery/entries/${id}`, { signal })).data.entry;
  },
  async filmEntriesPage(movieId: number, params: { limit?: number; offset?: number; scope?: 'everyone' | 'following' } = {}, signal?: AbortSignal): Promise<SocialContract['schemas']['FilmResponsesPage']> {
    return (await apiClient.get(`/discovery/films/${movieId}`, { params: { limit: 30, ...params }, signal })).data;
  },
  async peoplePage(params: { limit?: number; offset?: number; q?: string; scope?: 'all' | 'following' | 'discover' } = {}, signal?: AbortSignal): Promise<{ people: CommunityPerson[]; nextOffset: number | null }> {
    return (await apiClient.get('/discovery/people', { params: { limit: 30, ...params }, signal })).data;
  },
  async profile(username: string, params: { offset?: number; view?: 'responses' | 'films' } = {}, signal?: AbortSignal): Promise<SocialContract['schemas']['MemberProfilePage']> {
    return (await apiClient.get(`/discovery/people/${encodeURIComponent(username)}`, { params: { limit: 30, includeConnections: false, ...params }, signal })).data;
  },
  async connections(username: string, kind: 'followers' | 'following', offset?: number, signal?: AbortSignal): Promise<SocialContract['schemas']['ConnectionsPage']> {
    return (await apiClient.get(`/discovery/people/${encodeURIComponent(username)}/connections`, { params: { limit: 30, kind, offset }, signal })).data;
  },
  async activityPage(params: { limit?: number; offset?: number; kind?: ActivityFilter } = {}, signal?: AbortSignal): Promise<{ activity: ActivityEvent[]; nextOffset: number | null }> {
    return (await apiClient.get('/discovery/activity', { params: { ...params, includeResponses: true, includeSuggestions: true }, signal })).data;
  },
  async pulse(signal?: AbortSignal): Promise<CommunityFilm[]> {
    const response = await apiClient.get('/discovery/pulse', { signal });
    return response.data.films;
  },
  async follow(personId: number): Promise<void> {
    await apiClient.post(`/discovery/people/${personId}/follow`);
  },
  async unfollow(personId: number): Promise<void> {
    await apiClient.delete(`/discovery/people/${personId}/follow`);
  },
  async like(entryId: number): Promise<void> {
    await apiClient.post(`/discovery/entries/${entryId}/like`);
  },
  async unlike(entryId: number): Promise<void> {
    await apiClient.delete(`/discovery/entries/${entryId}/like`);
  },
  async commentsPage(entryId: number, offset?: number, signal?: AbortSignal): Promise<SocialContract['schemas']['CommentsPage']> {
    return (await apiClient.get(`/discovery/entries/${entryId}/comments`, { params: { limit: 30, offset }, signal })).data;
  },
  async addComment(entryId: number, body: string): Promise<EntryComment> {
    const response = await apiClient.post(`/discovery/entries/${entryId}/comments`, { body });
    return response.data.comment;
  },
  async deleteComment(commentId: number): Promise<void> {
    await apiClient.delete(`/discovery/comments/${commentId}`);
  },
};
