import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  theme: 'light' | 'dark';
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  toggleTheme: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      theme: 'dark',

      setAuth: (user, token) => {
        localStorage.setItem('smartpm_token', token);
        set({ user, token });
      },

      logout: () => {
        localStorage.removeItem('smartpm_token');
        localStorage.removeItem('smartpm_user');
        set({ user: null, token: null });
      },

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
        token: state.token,
        theme: state.theme,
      }),
    },
  ),
);
