import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../common/guards/jwt-auth.guard.js';
import type { IssuedTokens } from './token.service.js';

/**
 * The attributes every auth cookie shares: unreadable from script, Secure when
 * the deployment says so, and SameSite=Lax — which still sends them on a
 * top-level navigation back from an email link or from Google's consent
 * screen, both of which "strict" would drop.
 */
export function baseCookieOptions(config: ConfigService, path = '/'): CookieOptions {
  const domain = config.get<string>('AUTH_COOKIE_DOMAIN');
  return {
    httpOnly: true,
    secure: config.get<boolean>('AUTH_COOKIE_SECURE') ?? false,
    sameSite: 'lax',
    path,
    ...(domain ? { domain } : {}),
  };
}

export function setAuthCookies(
  config: ConfigService,
  response: Response,
  tokens: IssuedTokens,
): void {
  const base = baseCookieOptions(config);

  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    expires: tokens.accessTokenExpiresAt,
  });

  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    expires: tokens.refreshTokenExpiresAt,
  });
}

export function clearAuthCookies(config: ConfigService, response: Response): void {
  clearCookie(config, response, ACCESS_TOKEN_COOKIE);
  clearCookie(config, response, REFRESH_TOKEN_COOKIE);
}

/** Clears a cookie; path and domain must match the ones it was set with. */
export function clearCookie(
  config: ConfigService,
  response: Response,
  name: string,
  path = '/',
): void {
  const { domain } = baseCookieOptions(config, path);
  response.clearCookie(name, { path, ...(domain ? { domain } : {}) });
}
