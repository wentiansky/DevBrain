'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';
import { Header } from '@/components/header';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isInitialized, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized && !user) {
      const current = window.location.pathname + window.location.search;
      const next = encodeURIComponent(current);
      router.replace(`/login?next=${next}`);
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="h-14 border-b bg-background" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">正在加载...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="h-14 border-b bg-background" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}