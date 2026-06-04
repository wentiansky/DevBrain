'use client';

import dynamic from 'next/dynamic';

const WebVitalsInner = dynamic(
  () => import('@/components/web-vitals').then((m) => ({ default: m.WebVitals })),
  { ssr: false },
);

export function WebVitals() {
  return <WebVitalsInner />;
}