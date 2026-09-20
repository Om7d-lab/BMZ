import 'server-only';
import { cookies } from 'next/headers';
import { apiRequest, type RequestOptions } from './api';

/**
 * The API client for server components.
 *
 * The browser's auth cookies do not travel with a server-side fetch on their
 * own, so they are read out of the incoming request and forwarded explicitly.
 */
export async function serverApi<T>(
  path: string,
  options: Omit<RequestOptions, 'cookieHeader'> = {},
): Promise<T> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return apiRequest<T>(path, { ...options, cookieHeader });
}
