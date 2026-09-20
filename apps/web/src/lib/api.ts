import type { ApiError } from '@bmz/contracts';

/**
 * Where API requests go.
 *
 * A server component talks to the API directly, so it needs the API's absolute
 * origin (API_ORIGIN). The browser instead talks to this app's own origin and
 * lets the Next.js rewrite (see next.config.ts) forward the request to the API,
 * which keeps the SameSite=Lax auth cookie first-party. Both resolve to the
 * same API in the end; only the base differs.
 */
const SERVER_API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';
export const API_BASE = typeof window === 'undefined' ? `${SERVER_API_ORIGIN}/api/v1` : '/api/v1';

/** The header that names which workspace a request acts in. */
export const ORGANIZATION_HEADER = 'x-bmz-organization';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    override readonly message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** Messages for one field, for rendering beside its input. */
  fieldErrors(field: string): string[] {
    return this.details?.[field] ?? [];
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  organizationId?: string | null;
  /** Forwarded from a server component so the API sees the caller's cookies. */
  cookieHeader?: string;
  signal?: AbortSignal;
  /** Next.js fetch caching. Journal data is always live. */
  cache?: RequestCache;
}

/**
 * The single way this app talks to the API.
 *
 * Credentials are always included: authentication lives in httpOnly cookies
 * rather than in a token the page can read, which means no access token is
 * ever exposed to a script on the page.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    organizationId,
    cookieHeader,
    signal,
    cache = 'no-store',
  } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (organizationId) headers[ORGANIZATION_HEADER] = organizationId;
  // Browsers attach cookies themselves; a server component has to pass them on.
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    cache,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    const error = payload as ApiError | null;
    const message = Array.isArray(error?.message)
      ? error.message.join(', ')
      : (error?.message ?? `Request failed with status ${response.status}`);

    throw new ApiRequestError(response.status, message, error?.details);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Builds a query string, dropping empty values and expanding arrays. */
export function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      // Repeated keys rather than a comma list, so a value containing a comma
      // survives the round trip.
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') search.append(key, String(item));
      }
    } else {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}
