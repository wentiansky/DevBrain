'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';
import type { AuthResponse } from '@devbrain/api/client';
import { Header } from '@/components/header';
import { Skeleton } from '@/components/ui/skeleton';

declare global {
  interface Window {
    __AUTH_PREFETCH__?: Promise<AuthResponse | null>;
  }
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { isInitialized, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) {
      const prefetch = typeof window !== 'undefined' ? window.__AUTH_PREFETCH__ : undefined;
      if (prefetch) {
        prefetch
          .then((result) => {
            if (result?.accessToken) {
              useAuthStore.getState().setAuth(result);
            } else {
              useAuthStore.getState().clearAuth();
            }
          })
          .catch(() => {
            useAuthStore.getState().clearAuth();
          });
      } else {
        initializeAuth();
      }
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized && !user) {
      const currentPath = window.location.pathname + window.location.search;
      const next = encodeURIComponent(currentPath);
      router.replace(`/login?next=${next}&error=session_expired`);
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) {
    return (
      <>
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">DevBrain</span>
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-3xl px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}