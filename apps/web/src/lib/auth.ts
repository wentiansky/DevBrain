import type { AuthControllerMeResponse } from '@devbrain/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchCurrentUser(): Promise<AuthControllerMeResponse | null> {
  const res = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });

  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`获取当前用户失败: ${res.status}`);
  }

  return res.json();
}