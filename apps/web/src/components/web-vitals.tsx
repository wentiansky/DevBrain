'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    const { name, value, id, navigationType } = metric;

    const payload = { name, value, id, navigationType };

    if (process.env.NODE_ENV === 'development') {
      console.debug('[web-vitals]', payload);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_SENTRY_DSN
    ) {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureMessage('web-vital', {
          level: 'info',
          tags: {
            'web-vital-name': name,
            'navigation-type': navigationType,
          },
          extra: {
            value,
            id,
          },
        });
      });
    }
  });

  return null;
}