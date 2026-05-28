'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { initializeAuth } from '@/lib/api-fetch';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface AuthFormShellProps {
  title: string;
  description: string;
  serverError: string | null;
  children: ReactNode;
  footerLink: {
    text: string;
    label: string;
    href: string;
  };
}

export function AuthFormShell({
  title,
  description,
  serverError,
  children,
  footerLink,
}: AuthFormShellProps) {
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {children}

      <p className="text-center text-sm text-muted-foreground">
        {footerLink.text}
        <Link href={footerLink.href} className="ml-1 underline underline-offset-4 hover:text-primary">
          {footerLink.label}
        </Link>
      </p>
    </div>
  );
}