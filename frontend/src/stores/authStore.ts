import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, LoginRequest } from '../api/auth';
import { authApi, } from '../api/auth';
import { getApiError } from '../api/client';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, newPwd: string, confirm: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login(credentials);
          localStorage.setItem('auth_token', data.token);
          set({ token: data.token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: getApiError(err) });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Best effort
        }
        localStorage.removeItem('auth_token');
        set({ token: null, user: null, error: null });
      },

      changePassword: async (current, newPwd, confirm) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.changePassword({
            currentPassword: current,
            newPassword: newPwd,
            confirmPassword: confirm,
          });
          // Refresh user to get firstLogin=false
          await get().refreshMe();
          set({ isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: getApiError(err) });
          throw err;
        }
      },

      refreshMe: async () => {
        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          set({ token: null, user: null });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'academiahub-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export const useUser = () => useAuthStore((s) => s.user);
export const useToken = () => useAuthStore((s) => s.token);
export const useIsAuthenticated = () => {
  const token = useAuthStore((s) => s.token);
  return !!token && !!localStorage.getItem('auth_token');
};
