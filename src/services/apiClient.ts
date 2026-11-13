import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Moodie-Request': '1' },
});

apiClient.interceptors.response.use(response => response, error => {
  // A request the screen cancelled on purpose (navigation, account change, a
  // superseded read) is not a failed action and must not raise the error banner.
  if (axios.isCancel(error)) return Promise.reject(error);
  if (error.response?.status === 401 && !/\/auth\/(login|register|recover|me)$/.test(error.config?.url || '')) {
    window.dispatchEvent(new Event('moodie:session-expired'));
  }
  if (['post', 'patch', 'delete', 'put'].includes(error.config?.method) && !error.config?.url?.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent('moodie:action-error', { detail: apiError(error) }));
  }
  return Promise.reject(error);
});

export const apiError = (error: unknown, fallback = 'That change could not be saved. Try again.') =>
  axios.isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : fallback;
export default apiClient;
