import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  email: string;
  /** Session id, so revoking a session invalidates its access tokens too. */
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}

interface DeviceContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Access and refresh tokens.
 *
 * The access token is a short-lived JWT. The refresh token is 32 random bytes
 * stored only as a SHA-256 hash, so a database leak does not hand an attacker
 * live sessions. Refreshing rotates the token: the old row is marked replaced
 * and, if that same old token is presented again, the whole family is revoked —
 * that replay is the signature of a stolen token being used alongside the real
 * one.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    user: { id: string; email: string },
    device: DeviceContext = {},
  ): Promise<IssuedTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTtlMs());

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: device.userAgent ?? null,
        ipAddress: device.ipAddress ?? null,
      },
      select: { id: true },
    });

    const { accessToken, accessTokenExpiresAt } = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      sid: session.id,
    });

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      sessionId: session.id,
    };
  }

  /**
   * Exchanges a refresh token for a new pair. Throws if the token is unknown,
   * expired, or already rotated.
   */
  async rotate(refreshToken: string, device: DeviceContext = {}): Promise<IssuedTokens> {
    const tokenHash = this.hash(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, deletedAt: true } } },
    });

    if (!session || session.user.deletedAt) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.revokedAt) {
      // A revoked token being presented means it was captured before rotation.
      // Kill every session this user has and make them sign in again.
      this.logger.warn(`Refresh token replay detected for user ${session.userId}`);
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session has expired');
    }

    const nextToken = randomBytes(32).toString('base64url');
    const nextExpiresAt = new Date(Date.now() + this.refreshTtlMs());

    const nextSession = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: session.userId,
          tokenHash: this.hash(nextToken),
          expiresAt: nextExpiresAt,
          userAgent: device.userAgent ?? session.userAgent,
          ipAddress: device.ipAddress ?? session.ipAddress,
        },
        select: { id: true },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), replacedBy: created.id },
      });

      return created;
    });

    const { accessToken, accessTokenExpiresAt } = await this.signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      sid: nextSession.id,
    });

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken: nextToken,
      refreshTokenExpiresAt: nextExpiresAt,
      sessionId: nextSession.id,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** True when the session behind an access token is still live. */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!session) return false;
    return session.revokedAt === null && session.expiresAt.getTime() > Date.now();
  }

  private async signAccessToken(
    payload: AccessTokenPayload,
  ): Promise<{ accessToken: string; accessTokenExpiresAt: Date }> {
    const ttl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // jsonwebtoken types the lifetime as a template literal union; the value
      // is validated by parseDuration below, which rejects anything malformed.
      expiresIn: ttl as `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`,
    });

    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + parseDuration(ttl)),
    };
  }

  private refreshTtlMs(): number {
    return parseDuration(this.config.get<string>('JWT_REFRESH_TTL', '30d'));
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/** Parses `15m`, `30d`, `12h`, `45s` into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new RangeError(`Expected a duration like "15m", received "${value}"`);
  }

  const amount = Number(match[1]);
  switch (match[2]) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    default:
      return amount * 86_400_000;
  }
}
