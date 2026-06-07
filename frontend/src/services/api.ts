import axios from 'axios';
import { captureException } from '@/lib/sentry';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Origin without the /api suffix — used to build absolute URLs for static assets
// like uploaded task attachments served from /uploads/...
export const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export function fileUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartpm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login (skip for the login endpoint itself)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Intentional request cancellations (component unmount / query key change) are not errors
    if (axios.isCancel(error)) return Promise.reject(error);

    const status = error.response?.status;
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('smartpm_token');
      localStorage.removeItem('smartpm_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Report unexpected server errors and network failures to Sentry
    if (!status || status >= 500) {
      captureException(error, {
        url: error.config?.url,
        method: error.config?.method,
        status,
      });
    }

    return Promise.reject(error);
  },
);

export default api;
