import { describe, it, expect } from 'vitest';

interface RewriteRule {
  source: string;
  destination: string;
}

describe('next.config rewrites', () => {
  async function getRewrites(): Promise<RewriteRule[]> {
    const nextConfig = await import('../../next.config');
    const config = nextConfig.default;
    if (typeof config.rewrites !== 'function') {
      throw new Error('rewrites is not a function');
    }
    const result = await config.rewrites();
    return Array.isArray(result) ? result : [];
  }

  it('should define rewrites as an async function', async () => {
    const nextConfig = await import('../../next.config');
    const config = nextConfig.default;
    expect(typeof config.rewrites).toBe('function');
  });

  it('should include /auth/:path* rewrite', async () => {
    const rewrites = await getRewrites();
    const authRewrite = rewrites.find((r: RewriteRule) => r.source === '/auth/:path*');
    expect(authRewrite).toBeDefined();
    expect(authRewrite?.destination).toContain('/auth/:path*');
  });

  it('should include /api/:path* rewrite', async () => {
    const rewrites = await getRewrites();
    const apiRewrite = rewrites.find((r: RewriteRule) => r.source === '/api/:path*');
    expect(apiRewrite).toBeDefined();
  });

  it('should have auth and api rewrites pointing to same upstream', async () => {
    const rewrites = await getRewrites();
    const authRewrite = rewrites.find((r: RewriteRule) => r.source === '/auth/:path*');
    const apiRewrite = rewrites.find((r: RewriteRule) => r.source === '/api/:path*');

    const authUpstream = (authRewrite?.destination ?? '').split('/auth/')[0];
    const apiUpstream = (apiRewrite?.destination ?? '').split('/:path*')[0];

    expect(authUpstream).toBe(apiUpstream);
  });
});