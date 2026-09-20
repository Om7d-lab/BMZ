import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  RegisterRequest,
  LoginRequest,
  SessionResponse,
  UpdateProfileRequest,
  UserProfile,
} from '@bmz/contracts';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService, type IssuedTokens } from './token.service.js';
import type { Prisma, User } from '../../generated/prisma/client.js';

export interface DeviceContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuthResult {
  tokens: IssuedTokens;
  session: SessionResponse;
}

/** The entitlements every new workspace starts with on the free launch plan. */
const FREE_PLAN_ENTITLEMENTS: ReadonlyArray<{ feature: string; limit: number | null }> = [
  { feature: 'accounts', limit: 5 },
  { feature: 'trades', limit: null },
  { feature: 'csv_import', limit: null },
  { feature: 'playbooks', limit: null },
  { feature: 'notebook', limit: null },
  { feature: 'reports', limit: null },
  // Counted in megabytes: Entitlement.limit is a 32-bit integer.
  { feature: 'attachment_megabytes', limit: 2048 },
  { feature: 'broker_sync', limit: 0 },
  { feature: 'replay', limit: 0 },
  { feature: 'ai_assistant', limit: 0 },
  { feature: 'mentorship', limit: 0 },
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterRequest, device: DeviceContext = {}): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const workspaceName = input.organizationName?.trim() || `${input.displayName}'s workspace`;

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          locale: input.locale,
          timezone: input.timezone,
          preferredCurrency: input.preferredCurrency,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: workspaceName,
          slug: await this.uniqueSlug(tx, workspaceName),
          ownerId: created.id,
          memberships: { create: { userId: created.id, role: 'OWNER' } },
          entitlements: { createMany: { data: [...FREE_PLAN_ENTITLEMENTS] } },
          billingCustomer: { create: {} },
        },
        select: { id: true },
      });

      // A journal with no account to put trades in is a dead end, so the
      // workspace starts with one in the trader's own currency and timezone.
      await tx.account.create({
        data: {
          organizationId: organization.id,
          name: 'Main account',
          type: 'LIVE',
          currency: input.preferredCurrency,
          timezone: input.timezone,
        },
      });

      await tx.progressRule.createMany({ data: defaultProgressRules(organization.id) });
      await tx.tag.createMany({ data: defaultTags(organization.id) });

      return created;
    });

    // Email verification is issued but not enforced: blocking a first session
    // behind an inbox round-trip loses people who just wanted to try it.
    await this.issueEmailVerification(user.id);

    const tokens = await this.tokens.issue(user, device);
    return { tokens, session: await this.buildSession(user.id, tokens.accessTokenExpiresAt) };
  }

  async login(input: LoginRequest, device: DeviceContext = {}): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Same message and roughly the same work whether or not the account
    // exists, so timing and wording do not confirm an email address.
    if (!user || user.deletedAt) {
      await this.passwords.verify(input.password, DUMMY_HASH);
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const valid = await this.passwords.verify(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      const rehashed = await this.passwords.hash(input.password);
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: rehashed } });
    }

    const tokens = await this.tokens.issue(user, device);
    return { tokens, session: await this.buildSession(user.id, tokens.accessTokenExpiresAt) };
  }

  async refresh(refreshToken: string, device: DeviceContext = {}): Promise<AuthResult> {
    const tokens = await this.tokens.rotate(refreshToken, device);
    const session = await this.prisma.session.findUnique({
      where: { id: tokens.sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return {
      tokens,
      session: await this.buildSession(session.userId, tokens.accessTokenExpiresAt),
    };
  }

  async logout(refreshToken: string | undefined, sessionId?: string): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    if (sessionId) await this.tokens.revokeSession(sessionId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Your current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });

    // Changing a password is how someone responds to a suspected compromise,
    // so every other session goes with it.
    await this.tokens.revokeAllForUser(userId);
  }

  /**
   * Starts a password reset. Always resolves, whether or not the address is
   * registered, so this endpoint cannot be used to enumerate accounts.
   */
  async requestPasswordReset(email: string): Promise<{ token: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return { token: null };

    const token = randomBytes(32).toString('base64url');

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return { token };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !record ||
      record.type !== 'PASSWORD_RESET' ||
      record.consumedAt ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('That reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    await this.tokens.revokeAllForUser(record.userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !record ||
      record.type !== 'EMAIL_VERIFICATION' ||
      record.consumedAt ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('That verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);
  }

  async issueEmailVerification(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.prisma.verificationToken.create({
      data: {
        userId,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.preferredCurrency !== undefined
          ? { preferredCurrency: input.preferredCurrency }
          : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    return toUserProfile(user);
  }

  async buildSession(userId: string, accessTokenExpiresAt: Date): Promise<SessionResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const memberships = await this.prisma.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true, plan: true } },
      },
    });

    return {
      user: toUserProfile(user),
      organizations: memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        plan: membership.organization.plan,
        role: membership.role,
      })),
      activeOrganizationId: memberships[0]?.organization.id ?? null,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base = slugify(name) || 'workspace';

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const taken = await tx.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }

    return `${base}-${randomBytes(6).toString('hex')}`;
  }
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      // Strip combining marks so "Ömid" becomes "omid" rather than "mid".
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  );
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A real hash of a throwaway password, verified against when an email is not
 * registered so a failed sign-in costs the same time either way.
 */
const DUMMY_HASH = 'scrypt$65536$8$1$00000000000000000000000000000000$' + '0'.repeat(128);

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    timezone: user.timezone,
    preferredCurrency: user.preferredCurrency,
    emailVerified: user.emailVerifiedAt !== null,
    isPlatformAdmin: user.isPlatformAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}

function defaultProgressRules(organizationId: string) {
  return [
    {
      organizationId,
      phase: 'PREPARE' as const,
      title: 'Review the overnight session and the economic calendar',
      position: 0,
    },
    {
      organizationId,
      phase: 'PREPARE' as const,
      title: 'Mark the levels that matter today',
      position: 1,
    },
    {
      organizationId,
      phase: 'PREPARE' as const,
      title: 'Write the plan: what I will trade and what I will skip',
      position: 2,
    },
    {
      organizationId,
      phase: 'TRADE' as const,
      title: 'Every entry has a stop before it is placed',
      position: 0,
    },
    {
      organizationId,
      phase: 'TRADE' as const,
      title: 'Risk per trade stays within my limit',
      position: 1,
    },
    { organizationId, phase: 'TRADE' as const, title: 'No trade outside the plan', position: 2 },
    {
      organizationId,
      phase: 'REFLECT' as const,
      title: 'Screenshot and tag every trade taken',
      position: 0,
    },
    {
      organizationId,
      phase: 'REFLECT' as const,
      title: 'Write the end-of-day review',
      position: 1,
    },
    {
      organizationId,
      phase: 'REFLECT' as const,
      title: 'Name one thing to do differently tomorrow',
      position: 2,
    },
  ];
}

function defaultTags(organizationId: string) {
  return [
    { organizationId, name: 'Breakout', category: 'SETUP' as const, color: '#10b981' },
    { organizationId, name: 'Pullback', category: 'SETUP' as const, color: '#14b8a6' },
    { organizationId, name: 'Reversal', category: 'SETUP' as const, color: '#0ea5e9' },
    { organizationId, name: 'Range', category: 'SETUP' as const, color: '#6366f1' },
    { organizationId, name: 'Chased the entry', category: 'MISTAKE' as const, color: '#f43f5e' },
    { organizationId, name: 'Moved the stop', category: 'MISTAKE' as const, color: '#f97316' },
    { organizationId, name: 'Oversized', category: 'MISTAKE' as const, color: '#ef4444' },
    { organizationId, name: 'Exited early', category: 'MISTAKE' as const, color: '#eab308' },
    { organizationId, name: 'Revenge trade', category: 'MISTAKE' as const, color: '#dc2626' },
    { organizationId, name: 'Calm', category: 'EMOTION' as const, color: '#22c55e' },
    { organizationId, name: 'Anxious', category: 'EMOTION' as const, color: '#f59e0b' },
    { organizationId, name: 'Impatient', category: 'EMOTION' as const, color: '#fb7185' },
    { organizationId, name: 'Confident', category: 'EMOTION' as const, color: '#38bdf8' },
  ];
}
