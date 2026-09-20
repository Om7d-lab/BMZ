import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeTrade,
  tradingDayKey,
  type ExecutionInput as DomainExecutionInput,
} from '@bmz/core';
import type {
  BulkUpdateTradesRequest,
  CreateTradeRequest,
  ListTradesQuery,
  Paginated,
  Trade as ApiTrade,
  UpdateTradeRequest,
} from '@bmz/contracts';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { toPrisma } from '../../common/decimal.js';
import { tradeInclude, toApiTrade } from './trade.mapper.js';
import { Prisma } from '../../generated/prisma/client.js';

/** The subset of trade columns that @bmz/core derives from the fills. */
type ComputedTradeColumns = Pick<
  Prisma.TradeUncheckedCreateInput,
  | 'direction'
  | 'status'
  | 'openedAt'
  | 'closedAt'
  | 'durationMs'
  | 'tradingDay'
  | 'multiplier'
  | 'peakQuantity'
  | 'openQuantity'
  | 'closedQuantity'
  | 'averageEntryPrice'
  | 'averageExitPrice'
  | 'grossPnl'
  | 'fees'
  | 'netPnl'
  | 'netReturn'
  | 'initialRisk'
  | 'rMultiple'
  | 'plannedRewardRisk'
  | 'reversals'
>;

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListTradesQuery): Promise<Paginated<ApiTrade>> {
    const where = await this.buildWhere(organizationId, query);

    // One extra row tells us whether there is a next page without a count.
    const rows = await this.prisma.trade.findMany({
      where,
      include: tradeInclude,
      orderBy: [{ [query.sortBy]: query.sortDir }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      // The list view shows summary rows; the fills are fetched with the trade.
      items: page.map((trade) => toApiTrade(trade, { includeExecutions: false })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(organizationId: string, tradeId: string): Promise<ApiTrade> {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, organizationId, deletedAt: null },
      include: tradeInclude,
    });

    if (!trade) throw new NotFoundException('Trade not found');
    return toApiTrade(trade);
  }

  async create(organizationId: string, input: CreateTradeRequest): Promise<ApiTrade> {
    const account = await this.requireAccount(organizationId, input.accountId);
    await this.requireTags(organizationId, input.tagIds);

    const instrument = await this.resolveInstrument(
      organizationId,
      input.symbol,
      input.instrumentClass,
    );

    const computed = computeTrade(toDomainExecutions(input.executions), {
      instrumentClass: input.instrumentClass,
      symbol: input.symbol,
      multiplier: input.multiplier ?? instrument?.multiplier?.toString() ?? null,
      stopLoss: input.stopLoss ?? null,
      takeProfit: input.takeProfit ?? null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.create({
        data: {
          organizationId,
          accountId: account.id,
          instrumentId: instrument?.id ?? null,
          symbol: input.symbol,
          instrumentClass: input.instrumentClass,
          ...this.computedColumns(computed, account.timezone),
          stopLoss: toPrisma(input.stopLoss ?? null),
          takeProfit: toPrisma(input.takeProfit ?? null),
          rating: input.rating ?? null,
          notes: input.notes ?? null,
          playbookId: input.playbookId ?? null,
          reviewStatus: input.reviewStatus ?? 'UNREVIEWED',
          executions: {
            create: input.executions.map((execution) => ({
              organizationId,
              accountId: account.id,
              side: execution.side,
              quantity: toPrisma(execution.quantity)!,
              price: toPrisma(execution.price)!,
              fees: toPrisma(execution.fees)!,
              executedAt: new Date(execution.executedAt),
              orderId: execution.orderId ?? null,
            })),
          },
          ...(input.tagIds.length > 0
            ? { tags: { createMany: { data: input.tagIds.map((tagId) => ({ tagId })) } } }
            : {}),
        },
        include: tradeInclude,
      });

      await this.refreshTradingDay(tx, organizationId, account.id, trade.tradingDay);
      return trade;
    });

    return toApiTrade(created);
  }

  async update(
    organizationId: string,
    tradeId: string,
    input: UpdateTradeRequest,
  ): Promise<ApiTrade> {
    const existing = await this.prisma.trade.findFirst({
      where: { id: tradeId, organizationId, deletedAt: null },
      include: { executions: { where: { deletedAt: null }, orderBy: { executedAt: 'asc' } } },
    });

    if (!existing) throw new NotFoundException('Trade not found');
    if (input.tagIds) await this.requireTags(organizationId, input.tagIds);

    const account = await this.requireAccount(organizationId, existing.accountId);
    const symbol = input.symbol ?? existing.symbol;
    const instrumentClass = input.instrumentClass ?? existing.instrumentClass;

    // An omitted field keeps its stored value; `null` clears it. The two are
    // distinct here because clearing a stop is a meaningful edit.
    const stopLoss =
      input.stopLoss === undefined ? (existing.stopLoss?.toString() ?? null) : input.stopLoss;
    const takeProfit =
      input.takeProfit === undefined ? (existing.takeProfit?.toString() ?? null) : input.takeProfit;

    const instrument =
      input.symbol || input.instrumentClass
        ? await this.resolveInstrument(organizationId, symbol, instrumentClass)
        : existing.instrumentId
          ? await this.prisma.instrument.findFirst({
              where: { id: existing.instrumentId, organizationId },
            })
          : null;

    const executionsForMaths: DomainExecutionInput[] = input.executions
      ? toDomainExecutions(input.executions)
      : existing.executions.map((execution) => ({
          id: execution.id,
          side: execution.side,
          quantity: execution.quantity.toString(),
          price: execution.price.toString(),
          fees: execution.fees.toString(),
          executedAt: execution.executedAt,
        }));

    const multiplierOverride =
      input.multiplier === undefined
        ? (instrument?.multiplier?.toString() ?? null)
        : input.multiplier;

    const computed = computeTrade(executionsForMaths, {
      instrumentClass,
      symbol,
      multiplier: multiplierOverride,
      stopLoss,
      takeProfit,
    });

    const previousTradingDay = existing.tradingDay;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.executions) {
        // Replacing the fills soft-deletes the old ones so the record of what
        // the broker originally reported is not erased by a correction.
        await tx.execution.updateMany({
          where: { tradeId, deletedAt: null },
          data: { deletedAt: new Date() },
        });

        await tx.execution.createMany({
          data: input.executions.map((execution) => ({
            tradeId,
            organizationId,
            accountId: existing.accountId,
            side: execution.side,
            quantity: toPrisma(execution.quantity)!,
            price: toPrisma(execution.price)!,
            fees: toPrisma(execution.fees)!,
            executedAt: new Date(execution.executedAt),
            orderId: execution.orderId ?? null,
          })),
        });
      }

      if (input.tagIds) {
        await tx.tradeTag.deleteMany({ where: { tradeId } });
        if (input.tagIds.length > 0) {
          await tx.tradeTag.createMany({
            data: input.tagIds.map((tagId) => ({ tradeId, tagId })),
          });
        }
      }

      const trade = await tx.trade.update({
        where: { id: tradeId },
        data: {
          symbol,
          instrumentClass,
          instrumentId: instrument?.id ?? existing.instrumentId,
          ...this.computedColumns(computed, account.timezone),
          stopLoss: toPrisma(stopLoss),
          takeProfit: toPrisma(takeProfit),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.playbookId !== undefined ? { playbookId: input.playbookId } : {}),
          ...(input.reviewStatus !== undefined
            ? {
                reviewStatus: input.reviewStatus,
                reviewedAt: input.reviewStatus === 'REVIEWED' ? new Date() : null,
              }
            : {}),
        },
        include: tradeInclude,
      });

      await this.refreshTradingDay(tx, organizationId, existing.accountId, trade.tradingDay);
      if (previousTradingDay && previousTradingDay.getTime() !== trade.tradingDay?.getTime()) {
        await this.refreshTradingDay(tx, organizationId, existing.accountId, previousTradingDay);
      }

      return trade;
    });

    return toApiTrade(updated);
  }

  async remove(organizationId: string, tradeId: string): Promise<void> {
    const trade = await this.prisma.trade.findFirst({
      where: { id: tradeId, organizationId, deletedAt: null },
      select: { id: true, accountId: true, tradingDay: true },
    });

    if (!trade) throw new NotFoundException('Trade not found');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.trade.update({ where: { id: tradeId }, data: { deletedAt: now } });
      await tx.execution.updateMany({
        where: { tradeId, deletedAt: null },
        data: { deletedAt: now },
      });
      await this.refreshTradingDay(tx, organizationId, trade.accountId, trade.tradingDay);
    });
  }

  async bulkUpdate(
    organizationId: string,
    input: BulkUpdateTradesRequest,
  ): Promise<{ updated: number }> {
    const owned = await this.prisma.trade.findMany({
      where: { id: { in: input.tradeIds }, organizationId, deletedAt: null },
      select: { id: true },
    });

    // Silently skipping ids from another workspace would hide a real bug in the
    // client, so a mismatch is reported rather than filtered away.
    if (owned.length !== input.tradeIds.length) {
      throw new NotFoundException('Some of those trades do not exist in this workspace');
    }

    const ids = owned.map((trade) => trade.id);

    await this.prisma.$transaction(async (tx) => {
      // The unchecked variant accepts relation scalars such as playbookId directly.
      const data: Prisma.TradeUncheckedUpdateManyInput = {};
      if (input.reviewStatus !== undefined) {
        data.reviewStatus = input.reviewStatus;
        data.reviewedAt = input.reviewStatus === 'REVIEWED' ? new Date() : null;
      }
      if (input.rating !== undefined) data.rating = input.rating;
      if (input.playbookId !== undefined) data.playbookId = input.playbookId;

      if (Object.keys(data).length > 0) {
        await tx.trade.updateMany({ where: { id: { in: ids } }, data });
      }

      if (input.removeTagIds?.length) {
        await tx.tradeTag.deleteMany({
          where: { tradeId: { in: ids }, tagId: { in: input.removeTagIds } },
        });
      }

      if (input.addTagIds?.length) {
        await this.requireTags(organizationId, input.addTagIds, tx);
        await tx.tradeTag.createMany({
          data: ids.flatMap((tradeId) => input.addTagIds!.map((tagId) => ({ tradeId, tagId }))),
          skipDuplicates: true,
        });
      }
    });

    return { updated: ids.length };
  }

  async bulkDelete(organizationId: string, tradeIds: string[]): Promise<{ deleted: number }> {
    const owned = await this.prisma.trade.findMany({
      where: { id: { in: tradeIds }, organizationId, deletedAt: null },
      select: { id: true, accountId: true, tradingDay: true },
    });

    if (owned.length === 0) return { deleted: 0 };

    const now = new Date();
    const ids = owned.map((trade) => trade.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.trade.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
      await tx.execution.updateMany({
        where: { tradeId: { in: ids }, deletedAt: null },
        data: { deletedAt: now },
      });

      const affected = new Map<string, { accountId: string; day: Date | null }>();
      for (const trade of owned) {
        affected.set(`${trade.accountId}|${trade.tradingDay?.toISOString() ?? ''}`, {
          accountId: trade.accountId,
          day: trade.tradingDay,
        });
      }
      for (const { accountId, day } of affected.values()) {
        await this.refreshTradingDay(tx, organizationId, accountId, day);
      }
    });

    return { deleted: ids.length };
  }

  /** The columns derived from the execution set, written on every trade write. */
  private computedColumns(
    computed: ReturnType<typeof computeTrade>,
    accountTimezone: string,
  ): ComputedTradeColumns {
    return {
      direction: computed.direction,
      status: computed.status,
      openedAt: computed.openedAt,
      closedAt: computed.closedAt,
      durationMs: computed.durationMs === null ? null : BigInt(computed.durationMs),
      // A trade belongs to the day it was entered, in the account's timezone.
      tradingDay: new Date(`${tradingDayKey(computed.openedAt, accountTimezone)}T00:00:00.000Z`),
      multiplier: toPrisma(computed.multiplier)!,
      peakQuantity: toPrisma(computed.peakQuantity)!,
      openQuantity: toPrisma(computed.openQuantity)!,
      closedQuantity: toPrisma(computed.closedQuantity)!,
      averageEntryPrice: toPrisma(computed.averageEntryPrice),
      averageExitPrice: toPrisma(computed.averageExitPrice),
      grossPnl: toPrisma(computed.grossPnl)!,
      fees: toPrisma(computed.fees)!,
      netPnl: toPrisma(computed.netPnl)!,
      netReturn: toPrisma(computed.netReturn),
      initialRisk: toPrisma(computed.initialRisk),
      rMultiple: toPrisma(computed.rMultiple),
      plannedRewardRisk: toPrisma(computed.plannedRewardRisk),
      reversals: computed.reversals,
    };
  }

  /**
   * Recomputes a day's cached totals from its trades. The calendar reads these
   * columns directly, so they are refreshed inside the same transaction as the
   * change that invalidated them.
   */
  private async refreshTradingDay(
    tx: Prisma.TransactionClient,
    organizationId: string,
    accountId: string,
    day: Date | null,
  ): Promise<void> {
    if (!day) return;

    const trades = await tx.trade.findMany({
      where: { organizationId, accountId, tradingDay: day, deletedAt: null },
      select: { netPnl: true, status: true },
    });

    const netPnl = trades.reduce((total, trade) => total.plus(trade.netPnl), new Prisma.Decimal(0));

    const wins = trades.filter((trade) => trade.netPnl.greaterThan(0)).length;
    const losses = trades.filter((trade) => trade.netPnl.lessThan(0)).length;

    await tx.tradingDay.upsert({
      where: { organizationId_accountId_date: { organizationId, accountId, date: day } },
      create: {
        organizationId,
        accountId,
        date: day,
        netPnl,
        tradeCount: trades.length,
        winCount: wins,
        lossCount: losses,
      },
      update: {
        netPnl,
        tradeCount: trades.length,
        winCount: wins,
        lossCount: losses,
      },
    });
  }

  private async buildWhere(
    organizationId: string,
    query: ListTradesQuery,
  ): Promise<Prisma.TradeWhereInput> {
    const where: Prisma.TradeWhereInput = { organizationId, deletedAt: null };

    if (query.accountId) where.accountId = query.accountId;
    if (query.direction) where.direction = query.direction;
    if (query.status) where.status = query.status;
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus;
    if (query.playbookId) where.playbookId = query.playbookId;
    if (query.symbols?.length) where.symbol = { in: query.symbols };
    if (query.instrumentClasses?.length) where.instrumentClass = { in: query.instrumentClasses };

    if (query.search) {
      where.OR = [
        { symbol: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.from || query.to) {
      where.tradingDay = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
      };
    }

    if (query.minNetPnl || query.maxNetPnl) {
      where.netPnl = {
        ...(query.minNetPnl ? { gte: toPrisma(query.minNetPnl)! } : {}),
        ...(query.maxNetPnl ? { lte: toPrisma(query.maxNetPnl)! } : {}),
      };
    }

    // Several tags means "carries all of them", which is what a trader picking
    // two filters expects, rather than the union.
    if (query.tagIds?.length) {
      where.AND = query.tagIds.map((tagId) => ({ tags: { some: { tagId } } }));
    }

    return where;
  }

  private async requireAccount(organizationId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
      select: { id: true, timezone: true, currency: true },
    });

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  private async requireTags(
    organizationId: string,
    tagIds: string[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    if (tagIds.length === 0) return;

    const found = await client.tag.findMany({
      where: { id: { in: tagIds }, organizationId },
      select: { id: true },
    });

    if (found.length !== new Set(tagIds).size) {
      throw new BadRequestException('One or more tags do not exist in this workspace');
    }
  }

  /** Finds the workspace's instrument record for a symbol, if it has one. */
  private async resolveInstrument(
    organizationId: string,
    symbol: string,
    instrumentClass: CreateTradeRequest['instrumentClass'],
  ) {
    return this.prisma.instrument.findUnique({
      where: {
        organizationId_symbol_instrumentClass: { organizationId, symbol, instrumentClass },
      },
    });
  }
}

function toDomainExecutions(executions: CreateTradeRequest['executions']): DomainExecutionInput[] {
  return executions.map((execution, index) => ({
    // The maths only needs ids to be stable and distinct within one trade;
    // persisted rows get their real ids from the database.
    id: execution.id ?? `pending-${index}`,
    side: execution.side,
    quantity: execution.quantity,
    price: execution.price,
    fees: execution.fees,
    executedAt: new Date(execution.executedAt),
  }));
}
