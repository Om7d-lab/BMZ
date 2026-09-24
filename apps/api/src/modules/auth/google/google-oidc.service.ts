import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { GoogleClaims } from './google-policy.js';

interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

/** A failure the user should see as "Google sign-in didn't work" — never the detail. */
export class GoogleAuthError extends Error {
  override readonly name = 'GoogleAuthError';
}

const GOOGLE_ISSUER = 'https://accounts.google.com';

/**
 * Google sign-in over OpenID Connect: authorization code flow with PKCE, a
 * state value against login CSRF, and a nonce against ID-token replay.
 *
 * Endpoints come from the provider's discovery document rather than being
 * hard-coded, and the ID token is verified against the provider's published
 * signing keys — its issuer, audience, expiry and nonce all checked.
 */
@Injectable()
export class GoogleOidcService {
  private readonly logger = new Logger(GoogleOidcService.name);
  private discovery: DiscoveryDocument | null = null;
  private jwks: JWTVerifyGetKey | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID') &&
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
    );
  }

  get redirectUri(): string {
    const explicit = this.config.get<string>('GOOGLE_REDIRECT_URI');
    if (explicit) return explicit;
    const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    return `${webUrl.replace(/\/$/, '')}/api/v1/auth/google/callback`;
  }

  /** Fresh single-use values for one sign-in attempt. */
  static newAttempt(): { state: string; nonce: string; codeVerifier: string } {
    return {
      state: randomBytes(32).toString('base64url'),
      nonce: randomBytes(32).toString('base64url'),
      // 43 characters of base64url: the RFC 7636 minimum, full entropy.
      codeVerifier: randomBytes(32).toString('base64url'),
    };
  }

  async authorizationUrl(attempt: {
    state: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<string> {
    const { authorization_endpoint } = await this.loadDiscovery();
    const url = new URL(authorization_endpoint);

    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: createHash('sha256').update(attempt.codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      // Always offer the account chooser, so someone signed in to several
      // Google accounts can pick the right one instead of being auto-picked.
      prompt: 'select_account',
    }).toString();

    return url.toString();
  }

  /** Trades the one-time code for an ID token and returns its verified claims. */
  async exchangeCode(
    code: string,
    codeVerifier: string,
    expectedNonce: string,
  ): Promise<GoogleClaims> {
    const { token_endpoint } = await this.loadDiscovery();

    let response: Response;
    try {
      response = await fetch(token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new GoogleAuthError(`Token endpoint unreachable: ${(error as Error).message}`);
    }

    if (!response.ok) {
      // The body names the OAuth error (e.g. invalid_grant) but never a secret.
      const detail = await response.text().catch(() => '');
      throw new GoogleAuthError(
        `Token exchange failed (${response.status}): ${detail.slice(0, 200)}`,
      );
    }

    const body = (await response.json()) as { id_token?: unknown };
    if (typeof body.id_token !== 'string') {
      throw new GoogleAuthError('Token response carried no ID token');
    }

    return this.verifyIdToken(body.id_token, expectedNonce);
  }

  private async verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleClaims> {
    const discovery = await this.loadDiscovery();
    this.jwks ??= createRemoteJWKSet(new URL(discovery.jwks_uri));

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, this.jwks, {
        // Google signs with either form of its issuer; any other provider
        // (tests) must match its discovery document exactly.
        issuer:
          discovery.issuer === GOOGLE_ISSUER
            ? [GOOGLE_ISSUER, 'accounts.google.com']
            : discovery.issuer,
        audience: this.clientId,
        algorithms: ['RS256'],
        clockTolerance: 5,
      }));
    } catch (error) {
      throw new GoogleAuthError(`ID token rejected: ${(error as Error).message}`);
    }

    if (payload.nonce !== expectedNonce) {
      throw new GoogleAuthError('ID token nonce does not match this sign-in attempt');
    }

    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new GoogleAuthError('ID token is missing sub or email');
    }

    return {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      // Google sends a boolean, but has historically sent the string "true".
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }

  private async loadDiscovery(): Promise<DiscoveryDocument> {
    if (this.discovery) return this.discovery;

    const issuer = this.config.get<string>('GOOGLE_OIDC_ISSUER') ?? GOOGLE_ISSUER;
    const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new GoogleAuthError(`Discovery unreachable: ${(error as Error).message}`);
    }
    if (!response.ok) throw new GoogleAuthError(`Discovery failed (${response.status})`);

    const document = (await response.json()) as Partial<DiscoveryDocument>;
    if (
      !document.issuer ||
      !document.authorization_endpoint ||
      !document.token_endpoint ||
      !document.jwks_uri
    ) {
      throw new GoogleAuthError('Discovery document is incomplete');
    }

    // OpenID Connect Discovery §4.3: the document must name the issuer it was
    // fetched from, or an attacker who can serve it could vouch for anyone.
    if (document.issuer.replace(/\/$/, '') !== issuer.replace(/\/$/, '')) {
      throw new GoogleAuthError('Discovery document names a different issuer');
    }

    this.discovery = document as DiscoveryDocument;
    this.logger.log(`Loaded OpenID configuration for ${this.discovery.issuer}`);
    return this.discovery;
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
  }
}
