import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@devbrain/api/client';

const AUTH_LOGIN = '/auth/login';
const AUTH_REGISTER = '/auth/register';
const AUTH_REFRESH = '/auth/refresh';
const AUTH_LOGOUT = '/auth/logout';
const SKIP_REFRESH_HEADER = 'x-skip-refresh';

let refreshPromise: Promise<AuthResponse | null> | null = null;

function shouldRedirectToLogin(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path === '/login' || path === '/register') return false;
  return true;
}

function redirectToLogin(): void {
  if (!shouldRedirectToLogin()) return;
  const currentPath = window.location.pathname + window.location.search;
  const next = encodeURIComponent(currentPath);
  window.location.href = `/login?next=${next}`;
}

function isAnonymousAuthEndpoint(url: string): boolean {
  return [AUTH_LOGIN, AUTH_REGISTER, AUTH_REFRESH, AUTH_LOGOUT].includes(url);
}

async function doRefresh(): Promise<AuthResponse | null> {
  try {
    const res = await fetch(AUTH_REFRESH, {
      method: 'POST',
      credentials: 'include',
      headers: { [SKIP_REFRESH_HEADER]: '1' },
    });

    if (!res.ok) {
      return null;
    }

    const data: AuthResponse = await res.json();
    useAuthStore.getState().setAuth(data);
    return data;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const isRefreshRequest = options.headers
    ? (options.headers as Record<string, string>)[SKIP_REFRESH_HEADER] === '1'
    : false;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  delete headers[SKIP_REFRESH_HEADER];

  if (accessToken && !isAnonymousAuthEndpoint(url)) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let res = await fetch(url, fetchOptions);

  if (res.status === 401 && !isRefreshRequest) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const result = await refreshPromise;

    if (result) {
      const newHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      };
      delete newHeaders[SKIP_REFRESH_HEADER];

      if (!isAnonymousAuthEndpoint(url)) {
        newHeaders['Authorization'] = `Bearer ${result.accessToken}`;
      }

      res = await fetch(url, {
        ...options,
        headers: newHeaders,
        credentials: 'include',
      });
    } else {
      useAuthStore.getState().clearAuth();
      redirectToLogin();
      throw new Error('登录已过期，请重新登录');
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message =
      (errorBody as { message?: string }).message || `请求失败 (${res.status})`;
    const error = new Error(message) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export async function authLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>(AUTH_LOGIN, {
    method: 'POST',
    headers: { [SKIP_REFRESH_HEADER]: '1' },
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setAuth(data);
  return data;
}

export async function authRegister(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>(AUTH_REGISTER, {
    method: 'POST',
    headers: { [SKIP_REFRESH_HEADER]: '1' },
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setAuth(data);
  return data;
}

export async function authRefresh(): Promise<AuthResponse | null> {
  return doRefresh();
}

export async function authLogout(): Promise<void> {
  try {
    await apiFetch(AUTH_LOGOUT, {
      method: 'POST',
      headers: { [SKIP_REFRESH_HEADER]: '1' },
    });
  } catch {
    // 即使后端调用失败也清理本地状态
  }
}

export async function initializeAuth(): Promise<void> {
  const result = await authRefresh();
  if (!result) {
    useAuthStore.getState().clearAuth();
    if (shouldRedirectToLogin()) {
      redirectToLogin();
    }
  }
}

export function logout(): void {
  authLogout().finally(() => {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  });
}