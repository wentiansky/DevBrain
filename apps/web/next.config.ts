import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      'sonner',
      'next-themes',
    ],
  },

  async rewrites() {
    return [
      {
        source: '/storage/local/:path*',
        destination: `${API_URL}/storage/local/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${API_URL}/auth/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

const sentryConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});

export default sentryConfig;
