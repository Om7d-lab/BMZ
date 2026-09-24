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
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // The access token lives fifteen minutes and the browser drops its cookie
  // when it expires; the refresh token lives for weeks. Renewing here, before
  // anything renders, is what keeps someone signed in across that boundary —
  // without it the app would bounce between /login and /dashboard forever.
  const refreshed =
    !request.cookies.has(ACCESS_COOKIE) &&
    request.cookies.has(REFRESH_COOKIE) &&
    !isPrefetch(request)
      ? await refreshSession(request)
      : null;

  const hasSession = refreshed
    ? refreshed.ok
    : request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  let response: NextResponse;

  if (!hasSession && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = '/login';
    target.search = '';
    // Come back to where they were headed once they have signed in.
    target.searchParams.set('next', pathname);
    response = NextResponse.redirect(target);
  } else if (
    hasSession &&
    (pathname === '/login' || pathname === '/register') &&
    // The app sends people here with this flag when their cookies turned out
    // to be dead; bouncing them back would loop.
    searchParams.get('session') !== 'expired'
  ) {
    const target = request.nextUrl.clone();
    target.pathname = '/dashboard';
    target.search = '';
    response = NextResponse.redirect(target);
  } else if (refreshed?.ok) {
    // Hand the renewed cookies to this same render too, not just the browser,
    // so the server components below see a valid session straight away.
    const headers = new Headers(request.headers);
    headers.set('cookie', refreshed.cookieHeader);
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }

  // Renewed cookies on success; the API's clearing cookies on failure.
  for (const cookie of refreshed?.setCookies ?? []) response.headers.append('set-cookie', cookie);
  return response;
}

function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('sec-purpose')?.includes('prefetch') === true
  );
}

async function refreshSession(
  request: NextRequest,
): Promise<{ ok: boolean; setCookies: string[]; cookieHeader: string }> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE}=${request.cookies.get(REFRESH_COOKIE)?.value ?? ''}`,
        'user-agent': request.headers.get('user-agent') ?? '',
      },
      cache: 'no-store',
    });
    const setCookies = response.headers.getSetCookie();

    // The request's cookies with the renewed ones swapped in.
    const jar = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
    for (const line of setCookies) {
      const [pair = ''] = line.split(';');
      const index = pair.indexOf('=');
      if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
    const cookieHeader = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

    return { ok: response.ok, setCookies, cookieHeader };
  } catch {
    // The API is unreachable. Leave the cookies alone — the session may be
    // fine — and let the page's own request surface the outage.
    return { ok: false, setCookies: [], cookieHeader: '' };
  }
}

export const config = {
  // Static assets under public/ must be excluded, or a signed-out visitor gets
  // redirected to /login instead of the file — which would, among other things,
  // stop the sign-in screen's own background video from ever loading.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|mp4|webm|woff|woff2)$).*)',
  ],
};
