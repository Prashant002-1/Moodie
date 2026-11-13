import apiClient from './apiClient';

export interface AuthUser { id: number; email: string; username: string; bio: string }
export interface AuthResponse { user: AuthUser; recoveryCode?: string }
export const authService = {
  async me(): Promise<AuthUser> { return (await apiClient.get('/auth/me')).data.user; },
  async register(input: { email: string; username: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/register', input)).data; },
  async login(input: { identifier: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/login', input)).data; },
  async recover(input: { identifier: string; recoveryCode: string; password: string }): Promise<AuthResponse> { return (await apiClient.post('/auth/recover', input)).data; },
  async logout() { await apiClient.post('/auth/logout'); },
  async profile(bio: string): Promise<AuthUser> { return (await apiClient.patch('/auth/profile', { bio })).data.user; },
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
