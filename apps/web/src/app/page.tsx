import { cookies } from 'next/headers';
import { AuthRootPage } from '@/components/auth-root-page';

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasRefreshCookie = cookieStore.has('devbrain_refresh');

  return (
    <>
      {hasRefreshCookie && (
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `window.__AUTH_PREFETCH__=fetch('/auth/refresh',{method:'POST',credentials:'include',headers:{'x-skip-refresh':'1'}}).then(function(r){return r.ok?r.json():null}).catch(function(){return null});`,
          }}
        />
      )}
      <AuthRootPage hasRefreshCookie={hasRefreshCookie} />
    </>
  );
}