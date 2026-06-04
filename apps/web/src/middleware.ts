import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE_NAME = 'devbrain_refresh';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') {
    return NextResponse.next();
  }

  const hasRefreshToken = request.cookies.has(REFRESH_COOKIE_NAME);

  if (hasRefreshToken) {
    const response = NextResponse.next();
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate',
    );
    return response;
  }

  const response = NextResponse.next();
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=30, stale-while-revalidate=300',
  );
  response.headers.set(
    'CDN-Cache-Control',
    'public, max-age=30, stale-while-revalidate=300',
  );
  response.headers.set(
    'Cloudflare-CDN-Cache-Control',
    'public, max-age=30, stale-while-revalidate=300',
  );
  return response;
}

export const config = {
  matcher: '/',
};