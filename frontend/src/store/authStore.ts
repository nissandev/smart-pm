import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken } from '../services/api';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  theme: 'light' | 'dark';
  /** True once the startup /auth/me check has completed (success or failure). */
  sessionChecked: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  setSessionChecked: (checked: boolean) => void;
  toggleTheme: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      theme: 'dark',
      sessionChecked: false,

      setAuth: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user });
      },

      logout: () => {
        setAccessToken(null);
        set({ user: null });
      },

      setSessionChecked: (checked) => set({ sessionChecked: checked }),

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', next === 'dark');
        set({ theme: next });
      },
    }),
    {
      name: 'smartpm_auth',
      partialize: (state) => ({
        user: state.user,
        theme: state.theme,
        // accessToken intentionally excluded — lives in memory only (XSS protection)
        // sessionChecked intentionally excluded — re-verified on every app load
      }),
    },
  ),
);
