import apiClient from './apiClient';
import type { components } from '../types/generated/suggestions';
import type { SuggestionAction, SuggestionInput, SuggestionMessageInput, SuggestionQuery, SuggestionReplyInput } from '../types/suggestion';

type Schema = components['schemas'];

// Wire types come from the same contract used by the native API. No lifecycle
// state or recipient eligibility is computed independently in the browser.
export const suggestionService = {
  async list(params: SuggestionQuery = {}, signal?: AbortSignal) {
    return (await apiClient.get<Schema['SuggestionsPage']>('/suggestions', { params, signal })).data;
  },
  async get(id: number, signal?: AbortSignal) {
    return (await apiClient.get<Schema['SuggestionResult']>(`/suggestions/${id}`, { signal })).data.suggestion;
  },
  async recipients(q = '', signal?: AbortSignal) {
    return (await apiClient.get<Schema['Recipients']>('/suggestions/recipients', { params: { q }, signal })).data.people;
  },
  async create(input: SuggestionInput) {
    return (await apiClient.post<Schema['SuggestionResult']>('/suggestions', input)).data.suggestion;
  },
  async update(id: number, input: SuggestionAction) {
    return (await apiClient.patch<Schema['SuggestionResult']>(`/suggestions/${id}`, input)).data.suggestion;
  },
  async reply(id: number, input: SuggestionReplyInput) {
    return (await apiClient.put<Schema['SuggestionResult']>(`/suggestions/${id}/reply`, input)).data.suggestion;
  },
  async removeReply(id: number) { await apiClient.delete(`/suggestions/${id}/reply`); },
  async messages(id: number, offset = 0, signal?: AbortSignal) {
    return (await apiClient.get<Schema['MessagesPage']>(`/suggestions/${id}/messages`, { params: { offset }, signal })).data;
  },
  async sendMessage(id: number, input: SuggestionMessageInput) { await apiClient.post(`/suggestions/${id}/messages`, input); },
  async deleteMessage(id: number, messageId: number) { await apiClient.delete(`/suggestions/${id}/messages/${messageId}`); },
};
