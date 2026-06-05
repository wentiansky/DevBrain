'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
          <h1 className="text-4xl font-bold">出错了</h1>
          <p className="mt-2 text-muted-foreground">页面发生意外错误，请稍后重试。</p>
          <div className="mt-6 flex gap-3">
            <Button onClick={reset}>重试</Button>
            <Button variant="outline" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
