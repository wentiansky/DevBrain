import { create } from 'zustand';
import type { AuthUserResponse, AuthResponse } from '@devbrain/api/client';

export type AuthState = {
  accessToken: string | null;
  user: AuthUserResponse | null;
  isInitialized: boolean;
};

export type AuthActions = {
  setAuth: (response: AuthResponse) => void;
  clearAuth: () => void;
  setInitialized: (value: boolean) => void;
};

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  isInitialized: false,

  setAuth: (response: AuthResponse) => {
    set({
      accessToken: response.accessToken,
      user: response.user,
      isInitialized: true,
    });
  },

  clearAuth: () => {
    set({
      accessToken: null,
      user: null,
      isInitialized: true,
    });
  },

  setInitialized: (value: boolean) => {
    set({ isInitialized: value });
  },
}));