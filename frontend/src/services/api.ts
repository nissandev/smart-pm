import axios from 'axios';

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
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('smartpm_token');
      localStorage.removeItem('smartpm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
