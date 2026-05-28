'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';

export function UserStatus() {
  const { user, loading, error } = useCurrentUser();

  if (loading) {
    return (
      <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        加载用户信息...
      </span>
    );
  }

  if (error) {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
        获取用户失败: {error.message}
      </span>
    );
  }

  if (!user) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
        未登录
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
      {user.email} ({user.status})
    </span>
  );
}