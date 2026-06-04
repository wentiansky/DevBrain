import type { ReactNode } from 'react';
import { ProtectedShell } from '@/components/protected-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ProtectedShell>{children}</ProtectedShell>
    </div>
  );
}