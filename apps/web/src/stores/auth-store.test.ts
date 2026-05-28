import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isInitialized: false,
    });
  });

  it('should initialize with null values', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(false);
  });

  it('should set auth from login/register response', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth({
      accessToken: 'token-abc',
      user: mockUser,
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('token-abc');
    expect(state.user).toEqual(mockUser);
    expect(state.isInitialized).toBe(true);
  });

  it('should clear auth state', () => {
    useAuthStore.setState({
      accessToken: 'token-abc',
      user: { id: 'user-1', email: 'test@example.com', status: 'active', createdAt: '' },
      isInitialized: true,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(true);
  });

  it('should set initialized flag', () => {
    useAuthStore.getState().setInitialized(true);
    expect(useAuthStore.getState().isInitialized).toBe(true);

    useAuthStore.getState().setInitialized(false);
    expect(useAuthStore.getState().isInitialized).toBe(false);
  });
});