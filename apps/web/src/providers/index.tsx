'use client';

import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              error: 'bg-destructive text-destructive-foreground',
            },
          }}
        />
      </QueryProvider>
    </ThemeProvider>
  );
}