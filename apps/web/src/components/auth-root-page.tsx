'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';
import { Header } from '@/components/header';
import { LoginForm } from '@/features/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';

const KbHomeClient = dynamic(
  () => import('@/components/kb-home-client').then((m) => ({ default: m.KbHomeClient })),
  { ssr: false, loading: KbHomeClientSkeleton },
);

function KbHomeClientSkeleton() {
  return (
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
  );
}

function AuthLoadingShell() {
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
          <div className="mb-6 flex items-center justify-between">
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

export function AuthRootPage() {
  const { isInitialized, user } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return <AuthLoadingShell />;
  }

  if (user) {
    return (
      <>
        <Header />
        <KbHomeClient />
      </>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">登录 DevBrain</h1>
          <p className="text-sm text-muted-foreground">
            输入邮箱和密码登录你的知识库
          </p>
        </div>

        <LoginForm />

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