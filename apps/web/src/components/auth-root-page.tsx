'use client';

import { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { getOrStartRefresh } from '@/lib/api-fetch';
import type { AuthResponse } from '@devbrain/api/client';
import { Header } from '@/components/header';
import { LoginForm } from '@/features/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';

declare global {
  interface Window {
    __AUTH_PREFETCH__?: Promise<AuthResponse | null>;
  }
}

const KbHomeClient = dynamic(
  () =>
    import('@/components/kb-home-client').then((m) => ({
      default: m.KbHomeClient,
    })),
  {
    ssr: false,
    loading: () => (
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <Skeleton className="mb-6 h-8 w-36" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        </div>
      </main>
    ),
  },
);

function AuthMinimalShell() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center px-4">
          <span className="text-lg font-semibold">DevBrain</span>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
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

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function UnauthenticatedHome() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">登录 DevBrain</h1>
          <p className="text-sm text-muted-foreground">
            输入邮箱和密码登录你的知识库
          </p>
        </div>

        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          还没有账号？
          <a
            href="/register"
            className="ml-1 underline underline-offset-4 hover:text-primary"
          >
            立即注册
          </a>
        </p>
      </div>
    </div>
  );
}

interface AuthRootPageProps {
  hasRefreshCookie: boolean;
}

export function AuthRootPage({ hasRefreshCookie }: AuthRootPageProps) {
  const { isInitialized, user } = useAuthStore();

  useEffect(() => {
    if (!isInitialized && hasRefreshCookie) {
      if (typeof window !== 'undefined' && window.__AUTH_PREFETCH__) {
        window.__AUTH_PREFETCH__
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
        getOrStartRefresh()
          .then((result) => {
            if (!result) {
              useAuthStore.getState().clearAuth();
            }
          })
          .catch(() => {
            useAuthStore.getState().clearAuth();
          });
      }
    }
  }, [isInitialized, hasRefreshCookie]);

  if (!hasRefreshCookie) {
    return <UnauthenticatedHome />;
  }

  if (!isInitialized) {
    return <AuthMinimalShell />;
  }

  if (user) {
    return (
      <>
        <Header />
        <KbHomeClient />
      </>
    );
  }

  return <UnauthenticatedHome />;
}