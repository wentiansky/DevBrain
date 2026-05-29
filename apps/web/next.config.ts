import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
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

export default nextConfig;