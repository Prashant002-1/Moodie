import apiClient from './apiClient';
import type { components } from '../types/generated/social';

export type ReportInput = components['schemas']['ReportInput'];
export const reportReasons: ReportInput['reason'][] = ['Harassment', 'Hate or threats', 'Sexual content', 'Violence', 'Spam', 'Privacy', 'Other'];
export const safetyService = {
  async report(input: ReportInput): Promise<void> { await apiClient.post('/safety/reports', input); },
  async block(personId: number): Promise<void> { await apiClient.post(`/safety/blocks/${personId}`); },
  async unblock(personId: number): Promise<void> { await apiClient.delete(`/safety/blocks/${personId}`); },
  async blocked(offset?: number, signal?: AbortSignal): Promise<components['schemas']['BlockedPage']> {
    return (await apiClient.get('/safety/blocks', { params: { limit: 30, offset }, signal })).data;
  },
};
