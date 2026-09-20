import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { NO_TENANT_KEY } from '../decorators/no-tenant.decorator.js';
import type { MembershipRole } from '../../generated/prisma/client.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';

export const ORGANIZATION_HEADER = 'x-bmz-organization';

/**
 * Resolves the workspace a request is acting in and proves the caller belongs
 * to it, before any handler runs.
 *
 * This is the single place tenancy is enforced. Services take an
 * `organizationId` they can trust, so a query that forgets its tenant filter
 * is a bug in one file rather than a cross-tenant leak.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>(NO_TENANT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (skip) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // JwtAuthGuard runs first and rejects anonymous requests, so reaching here
    // without a user means the guards were wired in the wrong order.
    if (!request.user) {
      throw new ForbiddenException('Not signed in');
    }

    const requested = this.requestedOrganizationId(request);

    const membership = requested
      ? await this.prisma.membership.findUnique({
          where: { organizationId_userId: { organizationId: requested, userId: request.user.id } },
          select: {
            organizationId: true,
            role: true,
            organization: { select: { deletedAt: true } },
          },
        })
      : // With no workspace named, fall back to the caller's earliest one, which
        // is the workspace created for them at sign-up.
        await this.prisma.membership.findFirst({
          where: { userId: request.user.id, organization: { deletedAt: null } },
          orderBy: { joinedAt: 'asc' },
          select: {
            organizationId: true,
            role: true,
            organization: { select: { deletedAt: true } },
          },
        });

    // Not a member and does-not-exist are both reported as "no access", so the
    // header cannot be used to probe for which workspace ids are real.
    if (!membership || membership.organization.deletedAt) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const required = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required?.length && !required.includes(membership.role)) {
      throw new ForbiddenException('Your role does not allow this');
    }

    request.organizationId = membership.organizationId;
    request.organizationRole = membership.role;
    return true;
  }

  private requestedOrganizationId(request: RequestWithUser): string | null {
    const header = request.headers[ORGANIZATION_HEADER];
    if (Array.isArray(header)) {
      throw new BadRequestException(`Send at most one ${ORGANIZATION_HEADER} header`);
    }
    return header?.trim() || null;
  }
}
