import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE_NAME = 'devbrain_refresh';

const AUTH_PATHS = new Set(['/login', '/register']);

const PROTECTED_PREFIXES = ['/kb/'] as const;

const PROTECTED_EXACT = new Set<string>(['/']);

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.has(pathname);
}

function isProtectedPath(pathname: string): boolean {
  if (PROTECTED_EXACT.has(pathname)) return true;
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function safeEncodeURIComponent(value: string): string {
  return encodeURIComponent(value).replace(/%2F/g, '/');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefresh = request.cookies.has(REFRESH_COOKIE_NAME);

  if (isAuthPath(pathname)) {
    if (hasRefresh) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const response = NextResponse.next();
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate',
    );
    return response;
  }

  if (isProtectedPath(pathname)) {
    if (!hasRefresh) {
      const next = safeEncodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
    }

    const response = NextResponse.next();
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate',
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|auth/|storage/|_next/static|_next/image|favicon\\.ico).*)'],
};
