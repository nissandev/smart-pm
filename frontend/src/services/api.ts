import axios from 'axios';
import { captureException } from '@/lib/sentry';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Origin without the /api suffix — used to build absolute URLs for static assets
export const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export function fileUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Access token lives in memory only — never written to localStorage.
// Set by authStore.setAuth(); read here for every request header.
let _accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  _accessToken = token;
}

// Called by the refresh interceptor when refresh fails — avoids circular import.
let _onForceLogout: (() => void) | null = null;
export function registerLogoutHandler(fn: () => void) {
  _onForceLogout = fn;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: true, // send HttpOnly refresh-token cookie on every request
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

// Refresh-token rotation — transparently re-auth on 401 and replay original request
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function drainQueue(newToken: string) {
  pendingQueue.forEach(({ resolve }) => resolve(newToken));
  pendingQueue = [];
}

function rejectQueue(err: unknown) {
  pendingQueue.forEach(({ reject }) => reject(err));
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const status: number | undefined = error.response?.status;
    const url: string = error.config?.url ?? '';

    // Never attempt refresh for auth endpoints themselves
    const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some(
      (p) => url.includes(p),
    );

    if (status === 401 && !isAuthEndpoint) {
      const originalRequest = error.config;

      // If another request already kicked off a refresh, queue this one
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
        setAccessToken(data.accessToken);
        drainQueue(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        rejectQueue(refreshError);
        setAccessToken(null);
        _onForceLogout?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

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
