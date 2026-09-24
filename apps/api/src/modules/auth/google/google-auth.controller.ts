import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { timezone as timezoneSchema } from '@bmz/contracts';
import { Public } from '../../../common/decorators/public.decorator.js';
import { NoTenant } from '../../../common/decorators/no-tenant.decorator.js';
import { AuthService } from '../auth.service.js';
import { deviceContext } from '../auth.controller.js';
import { baseCookieOptions, clearCookie, setAuthCookies } from '../auth-cookies.js';
import { GoogleAuthError, GoogleOidcService } from './google-oidc.service.js';
import { safeNextPath } from './google-policy.js';
import {
  OAUTH_COOKIE_TTL_MS,
  OAUTH_LINK_COOKIE,
  OAUTH_LINK_COOKIE_PATH,
  OAUTH_TX_COOKIE,
  OAUTH_TX_COOKIE_PATH,
  OAuthStateService,
} from './oauth-state.js';

/**
 * The codes the sign-in page turns into a sentence. Only these ever reach the
 * browser — the underlying reason goes to the server log.
 */
type GoogleErrorCode =
  | 'google_cancelled'
  | 'google_failed'
  | 'google_expired'
  | 'google_unverified'
  | 'google_unavailable'
  | 'google_not_configured';

/**
 * Browser-facing Google sign-in. Both routes are full-page navigations that
 * answer with a redirect, never JSON: `start` sends the browser to Google,
 * and Google sends it back to `callback`.
 */
@ApiTags('auth')
@NoTenant()
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly oidc: GoogleOidcService,
    private readonly oauthState: OAuthStateService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('start')
  @ApiExcludeEndpoint()
  async start(
    @Query('next') next: string | undefined,
    @Query('tz') tz: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.oidc.isConfigured()) {
      return this.fail(response, 'google_not_configured');
    }

    const attempt = GoogleOidcService.newAttempt();

    let authorizationUrl: string;
    try {
      authorizationUrl = await this.oidc.authorizationUrl(attempt);
    } catch (error) {
      this.logger.warn(`Could not start Google sign-in: ${(error as Error).message}`);
      return this.fail(response, 'google_failed');
    }

    const parsedTimezone = timezoneSchema.safeParse(tz);
    const transaction = await this.oauthState.signTransaction({
      ...attempt,
      next: safeNextPath(typeof next === 'string' ? next : null),
      // Only used if this sign-in creates the account, so its first trading
      // day lands on the right calendar date.
      timezone: parsedTimezone.success ? parsedTimezone.data : 'UTC',
    });

    response.cookie(OAUTH_TX_COOKIE, transaction, {
      ...baseCookieOptions(this.config, OAUTH_TX_COOKIE_PATH),
      maxAge: OAUTH_COOKIE_TTL_MS,
    });
    response.redirect(302, authorizationUrl);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string> | undefined;
    const transaction = await this.oauthState.readTransaction(cookies?.[OAUTH_TX_COOKIE]);

    // Single use, whatever happens next.
    clearCookie(this.config, response, OAUTH_TX_COOKIE, OAUTH_TX_COOKIE_PATH);

    const next = transaction?.next ?? '/dashboard';

    if (typeof query.error === 'string') {
      // access_denied is the person pressing "Cancel" on Google's screen.
      if (query.error !== 'access_denied') {
        this.logger.warn(`Google returned an error: ${query.error.slice(0, 64)}`);
      }
      return this.fail(
        response,
        query.error === 'access_denied' ? 'google_cancelled' : 'google_failed',
        next,
      );
    }

    // No transaction means the ten minutes ran out, cookies are blocked, or
    // this callback was not started by this browser — a forged or replayed
    // link. None of them may proceed.
    if (!transaction) return this.fail(response, 'google_expired');

    if (typeof query.state !== 'string' || !constantTimeEqual(query.state, transaction.state)) {
      this.logger.warn('Google callback state did not match this browser’s sign-in attempt');
      return this.fail(response, 'google_failed', next);
    }

    if (typeof query.code !== 'string' || query.code.length === 0) {
      return this.fail(response, 'google_failed', next);
    }

    try {
      const claims = await this.oidc.exchangeCode(
        query.code,
        transaction.codeVerifier,
        transaction.nonce,
      );

      const outcome = await this.auth.signInWithGoogle(claims, {
        timezone: transaction.timezone,
        device: deviceContext(request),
      });

      switch (outcome.kind) {
        case 'signed-in':
          setAuthCookies(this.config, response, outcome.result.tokens);
          clearCookie(this.config, response, OAUTH_LINK_COOKIE, OAUTH_LINK_COOKIE_PATH);
          return response.redirect(302, this.webUrl(next));

        case 'link-required': {
          const link = await this.oauthState.signPendingLink({
            sub: claims.sub,
            email: claims.email,
          });
          response.cookie(OAUTH_LINK_COOKIE, link, {
            ...baseCookieOptions(this.config, OAUTH_LINK_COOKIE_PATH),
            maxAge: OAUTH_COOKIE_TTL_MS,
          });
          // The page says only that this email already has a password
          // account — which the visitor just proved they own the inbox for.
          const params = new URLSearchParams({ link: 'google', next });
          return response.redirect(302, this.webUrl(`/login?${params.toString()}`));
        }

        case 'rejected':
          return this.fail(
            response,
            outcome.reason === 'unverified' ? 'google_unverified' : 'google_unavailable',
            next,
          );
      }
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        this.logger.warn(`Google sign-in failed: ${error.message}`);
      } else {
        this.logger.error('Google sign-in failed unexpectedly', (error as Error).stack);
      }
      return this.fail(response, 'google_failed', next);
    }
  }

  private fail(response: Response, code: GoogleErrorCode, next?: string): void {
    const params = new URLSearchParams({ error: code });
    if (next && next !== '/dashboard') params.set('next', next);
    response.redirect(302, this.webUrl(`/login?${params.toString()}`));
  }

  /**
   * Relative on purpose. These routes are only ever reached through the web
   * app's /api rewrite, so the browser resolves the path against the origin it
   * is actually on. An absolute URL built from WEB_URL would send everyone to
   * localhost the moment that variable is missing in a deployment.
   */
  private webUrl(path: string): string {
    return path;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
