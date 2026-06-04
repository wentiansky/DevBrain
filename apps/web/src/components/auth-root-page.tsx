'use client';

import { useEffect, Suspense } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';
import { Header } from '@/components/header';
import { KbHomeClient } from '@/components/kb-home-client';
import { AuthPageShell } from '@/features/auth/auth-page-shell';
import { LoginForm } from '@/features/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';

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
        <main className="flex-1">
          <KbHomeClient />
        </main>
      </>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Suspense
        fallback={
          <AuthPageShell
            title="登录 DevBrain"
            description="输入邮箱和密码登录你的知识库"
            footerLink={{ text: '还没有账号？', label: '立即注册', href: '/register' }}
          >
            <LoginFormSkeleton />
          </AuthPageShell>
        }
      >
        <AuthPageShell
          title="登录 DevBrain"
          description="输入邮箱和密码登录你的知识库"
          footerLink={{ text: '还没有账号？', label: '立即注册', href: '/register' }}
        >
          <LoginForm />
        </AuthPageShell>
      </Suspense>
    </div>
  );
}