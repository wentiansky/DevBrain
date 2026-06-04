import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WebVitals } from '@/components/web-vitals';

let triggerWebVital: (metric: unknown) => void;

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (cb: (metric: unknown) => void) => {
    triggerWebVital = cb;
  },
}));

const LCP_METRIC = {
  name: 'LCP',
  value: 1234.56,
  id: 'v3-1234567890-1',
  navigationType: 'navigate' as const,
  rating: 'good' as const,
  entries: [] as PerformanceEntry[],
  delta: 1234.56,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

describe('WebVitals', () => {
  it('dev 环境调用 console.debug', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<WebVitals />);
    triggerWebVital(LCP_METRIC);

    expect(console.debug).toHaveBeenCalled();
  });

  it('prod 环境不抛错', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<WebVitals />);

    expect(() => triggerWebVital(LCP_METRIC)).not.toThrow();
    expect(console.debug).not.toHaveBeenCalled();
  });
});