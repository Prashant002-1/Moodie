import { authService } from '../../src/services/authService';
import { apiClient } from '../../src/services/apiClient';
import { vi } from 'vitest';

it('clears legacy demo credentials without storing a session token in JavaScript storage', () => {
  vi.clearAllMocks();
  localStorage.setItem('auth-token', 'old'); sessionStorage.setItem('auth-token', 'old');
  authService.clear();
  expect(localStorage.removeItem).toHaveBeenCalledWith('auth-token');
  expect(sessionStorage.getItem('auth-token')).toBeNull();
  expect(apiClient.defaults.withCredentials).toBe(true);
  expect(apiClient.defaults.headers['X-Moodie-Request']).toBe('1');
});
