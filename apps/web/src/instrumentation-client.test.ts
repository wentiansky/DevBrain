import { describe, expect, it, vi } from 'vitest';

const sentryMock = vi.hoisted(() => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentryMock);

vi.mock('./lib/sentry', () => ({
  sanitizeEvent: vi.fn((event) => event),
}));

describe('instrumentation-client', () => {
  it('应导出客户端路由切换埋点 hook', async () => {
    vi.resetModules();

    const instrumentationClient = await import('./instrumentation-client');

    expect(instrumentationClient.onRouterTransitionStart).toBe(
      sentryMock.captureRouterTransitionStart,
    );
  });
});
