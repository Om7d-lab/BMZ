import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'bmz_access';
const REFRESH_COOKIE = 'bmz_refresh';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Keeps signed-out visitors out of the app and signed-in traders out of the
 * sign-in screen.
 *
 * This is a routing convenience, not the security boundary: it only checks
 * whether a session cookie is present, never whether it is valid. Every actual
 * authorisation decision is made by the API, which verifies the token and the
 * workspace membership on every request.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = '/login';
    // Come back to where they were headed once they have signed in.
    target.searchParams.set('next', pathname);
    return NextResponse.redirect(target);
  }

  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    const target = request.nextUrl.clone();
    target.pathname = '/dashboard';
    target.search = '';
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};
