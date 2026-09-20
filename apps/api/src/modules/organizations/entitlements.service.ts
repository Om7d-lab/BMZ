import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Feature gating.
 *
 * Nothing in the app branches on a plan name. Code asks whether the workspace
 * is entitled to a feature, and the entitlement rows decide — so launching a
 * paid tier later is a data change, not a hunt through conditionals.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(organizationId: string, feature: string): Promise<boolean> {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { organizationId_feature: { organizationId, feature } },
      select: { enabled: true, limit: true },
    });

    // An unknown feature is off. A new capability has to be granted
    // deliberately rather than appearing for everyone the day it ships.
    if (!entitlement) return false;
    if (!entitlement.enabled) return false;
    return entitlement.limit === null || entitlement.limit > 0;
  }

  async assertEnabled(organizationId: string, feature: string): Promise<void> {
    if (!(await this.isEnabled(organizationId, feature))) {
      throw new ForbiddenException(`Your plan does not include ${feature.replace(/_/g, ' ')}`);
    }
  }

  /**
   * Checks a countable limit before creating another one of something. The
   * count is supplied by the caller so this service never needs to know how
   * each resource is counted.
   */
  async assertWithinLimit(
    organizationId: string,
    feature: string,
    currentCount: () => Promise<number>,
  ): Promise<void> {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { organizationId_feature: { organizationId, feature } },
      select: { enabled: true, limit: true },
    });

    if (!entitlement?.enabled) {
      throw new ForbiddenException(`Your plan does not include ${feature.replace(/_/g, ' ')}`);
    }

    if (entitlement.limit === null) return;

    const count = await currentCount();
    if (count >= entitlement.limit) {
      throw new ForbiddenException(
        `Your plan allows ${entitlement.limit} ${feature.replace(/_/g, ' ')}. Archive one or upgrade to add another.`,
      );
    }
  }

  async list(
    organizationId: string,
  ): Promise<Array<{ feature: string; enabled: boolean; limit: number | null }>> {
    return this.prisma.entitlement.findMany({
      where: { organizationId },
      select: { feature: true, enabled: true, limit: true },
      orderBy: { feature: 'asc' },
    });
  }
}
