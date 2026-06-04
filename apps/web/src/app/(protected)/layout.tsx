import type { ReactNode } from 'react';
import { ProtectedShell } from '@/components/protected-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `window.__AUTH_PREFETCH__=fetch('/auth/refresh',{method:'POST',credentials:'include',headers:{'x-skip-refresh':'1'}}).then(function(r){return r.ok?r.json():null}).catch(function(){return null});`,
        }}
      />
      <ProtectedShell>{children}</ProtectedShell>
    </div>
  );
}