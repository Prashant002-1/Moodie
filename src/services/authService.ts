import apiClient from './apiClient';

export type AiMode = 'on' | 'off';
// ai_mode is null until the person chooses during onboarding. It is absent only on older servers.
export interface AuthUser { id: number; email: string; username: string; bio: string; ai_mode?: AiMode | null }
export interface AuthResponse { user: AuthUser; recoveryCode?: string }
export const authService = {
  async me(): Promise<AuthUser> { return (await apiClient.get('/auth/me')).data.user; },
  async register(input: { email: string; username: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/register', input)).data; },
  async login(input: { identifier: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/login', input)).data; },
  async recover(input: { identifier: string; recoveryCode: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/recover', input)).data; },
  async logout() { await apiClient.post('/auth/logout'); },
  async profile(bio: string): Promise<AuthUser> { return (await apiClient.patch('/auth/profile', { bio })).data.user; },
  async preferences(aiMode: AiMode): Promise<AuthUser> { return (await apiClient.patch('/auth/preferences', { aiMode })).data.user; },
  async password(currentPassword: string, password: string) { await apiClient.post('/auth/password', { currentPassword, password }); },
  async deleteAccount(password: string) { await apiClient.delete('/auth/account', { data: { password } }); },
  clear() {
    for (const key of ['localStorage', 'sessionStorage'] as const) {
      try {
        window[key].removeItem('auth-token');
        window[key].removeItem('auth-user');
      } catch { /* Legacy storage cleanup must not undo a server auth result. */ }
    }
  },
};
