'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isInitialized, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized && user) {
      router.replace('/');
    }
  }, [isInitialized, user, router]);

  return <>{children}</>;
}