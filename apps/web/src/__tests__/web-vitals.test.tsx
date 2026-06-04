import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { WebVitals } from '@/components/web-vitals';

const mockCaptureMessage = vi.fn();

let triggerWebVital: (metric: unknown) => void;

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (cb: (metric: unknown) => void) => {
    triggerWebVital = cb;
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  captureRouterTransitionStart: vi.fn(),
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

const INP_METRIC = {
  name: 'INP',
  value: 88,
  id: 'v3-1234567890-2',
  navigationType: 'navigate' as const,
  rating: 'good' as const,
  entries: [] as PerformanceEntry[],
  delta: 88,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  mockCaptureMessage.mockReset();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

describe('WebVitals', () => {
  it('dev 环境走 console.debug', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<WebVitals />);
    triggerWebVital(LCP_METRIC);

    expect(console.debug).toHaveBeenCalledWith('[web-vitals]', {
      name: 'LCP',
      value: 1234.56,
      id: 'v3-1234567890-1',
      navigationType: 'navigate',
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('prod + DSN 时走 Sentry captureMessage', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@o1.ingest.sentry.io/1');
    render(<WebVitals />);
    triggerWebVital(INP_METRIC);

    await waitFor(() => {
      expect(mockCaptureMessage).toHaveBeenCalledWith('web-vital', {
        level: 'info',
        tags: {
          'web-vital-name': 'INP',
          'navigation-type': 'navigate',
        },
        extra: {
          value: 88,
          id: 'v3-1234567890-2',
        },
      });
    });
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('prod 无 DSN 时不抛错且不调 Sentry', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    render(<WebVitals />);

    expect(() => triggerWebVital(LCP_METRIC)).not.toThrow();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('上报 payload 不含 URL 路径、token、邮箱', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@o1.ingest.sentry.io/1');
    render(<WebVitals />);
    triggerWebVital(LCP_METRIC);

    await waitFor(() => {
      expect(mockCaptureMessage).toHaveBeenCalled();
    });

    const callArgs = mockCaptureMessage.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(callArgs).toBeDefined();
    const payload = JSON.stringify(callArgs);
    expect(payload).not.toMatch(/\/kb\//);
    expect(payload).not.toMatch(/token/i);
    expect(payload).not.toContain('email');
    expect(payload).not.toMatch(/@/);
  });
});