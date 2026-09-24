import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';

/** Carries PKCE, state and nonce from /google/start to /google/callback. */
export const OAUTH_TX_COOKIE = 'bmz_oauth_tx';
/** A verified Google identity waiting for its owner to prove the password. */
export const OAUTH_LINK_COOKIE = 'bmz_oauth_link';

/** Sent only to the Google routes, which are the only ones that read it. */
export const OAUTH_TX_COOKIE_PATH = '/api/v1/auth/google';
/** Sent to the auth routes, because the password login is what consumes it. */
export const OAUTH_LINK_COOKIE_PATH = '/api/v1/auth';

/** Both cookies live ten minutes: long enough for a consent screen, no longer. */
export const OAUTH_COOKIE_TTL_MS = 10 * 60 * 1000;

const TX_AUDIENCE = 'bmz:oauth-transaction';
const LINK_AUDIENCE = 'bmz:oauth-pending-link';

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  next: string;
  timezone: string;
}

export interface PendingGoogleLink {
  sub: string;
  email: string;
}

/**
 * Signs the two short-lived OAuth cookies.
 *
 * They are signed with a key derived from the access-token secret rather than
 * the secret itself, and each carries its own audience, so neither can ever be
 * accepted as an access token — or as each other.
 */
@Injectable()
export class OAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get key(): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update('bmz/oauth-cookie/v1')
      .digest('base64url');
  }

  signTransaction(tx: OAuthTransaction): Promise<string> {
    return this.jwt.signAsync(
      { ...tx },
      { secret: this.key, audience: TX_AUDIENCE, expiresIn: '10m' },
    );
  }

  async readTransaction(token: string | undefined): Promise<OAuthTransaction | null> {
    const payload = await this.verify<OAuthTransaction>(token, TX_AUDIENCE);
    if (
      !payload ||
      typeof payload.state !== 'string' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.codeVerifier !== 'string'
    ) {
      return null;
    }
    return payload;
  }

  signPendingLink(link: PendingGoogleLink): Promise<string> {
    return this.jwt.signAsync(
      { ...link },
      { secret: this.key, audience: LINK_AUDIENCE, expiresIn: '10m' },
    );
  }

  async readPendingLink(token: string | undefined): Promise<PendingGoogleLink | null> {
    const payload = await this.verify<PendingGoogleLink>(token, LINK_AUDIENCE);
    if (!payload || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return payload;
  }

  private async verify<T extends object>(
    token: string | undefined,
    audience: string,
  ): Promise<T | null> {
    if (!token) return null;
    try {
      return await this.jwt.verifyAsync<T>(token, {
        secret: this.key,
        audience,
        algorithms: ['HS256'],
      });
    } catch {
      // Expired, tampered or for another purpose: all the same to the caller.
      return null;
    }
  }
}
