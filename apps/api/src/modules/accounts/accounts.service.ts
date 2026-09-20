import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@bmz/core';
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@bmz/contracts';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { toPrisma } from '../../common/decimal.js';
import { EntitlementsService } from '../organizations/entitlements.service.js';
import type { Account as AccountRow } from '../../generated/prisma/client.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(organizationId: string, includeArchived = false): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
    });

    // One grouped query rather than a count per account, so the switcher does
    // not get slower as a trader adds accounts.
    const totals = await this.prisma.trade.groupBy({
      by: ['accountId'],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
      _sum: { netPnl: true },
    });

    const byAccount = new Map(totals.map((row) => [row.accountId, row]));

    return accounts.map((account) => {
      const total = byAccount.get(account.id);
      const netPnl = new Decimal(total?._sum.netPnl?.toString() ?? '0');

      return {
        ...toApiAccount(account),
        tradeCount: total?._count._all ?? 0,
        netPnl: netPnl.toString(),
        currentBalance: new Decimal(account.startingBalance.toString()).plus(netPnl).toString(),
      };
    });
  }

  async get(organizationId: string, accountId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
    });

    if (!account) throw new NotFoundException('Account not found');
    return toApiAccount(account);
  }

  async create(organizationId: string, input: CreateAccountRequest): Promise<Account> {
    await this.entitlements.assertWithinLimit(organizationId, 'accounts', () =>
      this.prisma.account.count({ where: { organizationId, deletedAt: null } }),
    );

    const account = await this.prisma.account.create({
      data: {
        organizationId,
        name: input.name,
        type: input.type,
        broker: input.broker ?? null,
        accountNumber: input.accountNumber ?? null,
        currency: input.currency,
        startingBalance: toPrisma(input.startingBalance)!,
        timezone: input.timezone,
      },
    });

    return toApiAccount(account);
  }

  async update(
    organizationId: string,
    accountId: string,
    input: UpdateAccountRequest,
  ): Promise<Account> {
    const existing = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
      select: { id: true, timezone: true },
    });

    if (!existing) throw new NotFoundException('Account not found');

    // Changing the timezone moves every trade's calendar day, which would
    // silently rewrite the trader's history. Stage two adds the recalculation
    // job; until then the change is refused rather than half-applied.
    if (input.timezone && input.timezone !== existing.timezone) {
      const tradeCount = await this.prisma.trade.count({
        where: { accountId, deletedAt: null },
      });
      if (tradeCount > 0) {
        throw new BadRequestException(
          'This account already has trades. Changing its timezone would move them to different days, so it is not allowed yet.',
        );
      }
    }

    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.broker !== undefined ? { broker: input.broker } : {}),
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.startingBalance !== undefined
          ? { startingBalance: toPrisma(input.startingBalance)! }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      },
    });

    return toApiAccount(account);
  }

  async remove(organizationId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!account) throw new NotFoundException('Account not found');

    // Soft delete only: an account's trades are the trader's record, and a
    // hard delete here would take them with it.
    await this.prisma.account.update({
      where: { id: accountId },
      data: { deletedAt: new Date(), isArchived: true },
    });
  }
}

export function toApiAccount(account: AccountRow): Account {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    broker: account.broker,
    currency: account.currency,
    startingBalance: account.startingBalance.toString(),
    timezone: account.timezone,
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
  };
}
