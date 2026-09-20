import { Injectable } from '@nestjs/common';
import {
  buildEquityCurve,
  Decimal,
  safeDivide,
  summarizePerformance,
  tradingDayKey,
  tradingDayRange,
  type TradeMetricInput,
} from '@bmz/core';
import type {
  AnalyticsQuery,
  BreakdownDimension,
  BreakdownResponse,
  BreakdownRow,
  CalendarResponse,
  DashboardOverview,
  EquityCurve,
  PerformanceSummary,
} from '@bmz/contracts';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** The trade columns every analytic reads. Kept narrow so the queries stay cheap. */
const analyticsSelect = {
  id: true,
  symbol: true,
  instrumentClass: true,
  direction: true,
  netPnl: true,
  fees: true,
  rMultiple: true,
  openedAt: true,
  closedAt: true,
  durationMs: true,
  tradingDay: true,
  playbookId: true,
} as const satisfies Prisma.TradeSelect;

type AnalyticsTrade = Prisma.TradeGetPayload<{ select: typeof analyticsSelect }>;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: AnalyticsQuery): Promise<PerformanceSummary> {
    const trades = await this.fetch(organizationId, query);
    return serializeSummary(summarizePerformance(trades.map(toMetricInput)));
  }

  async equityCurve(organizationId: string, query: AnalyticsQuery): Promise<EquityCurve> {
    const trades = await this.fetch(organizationId, query);
    const startingBalance = await this.startingBalance(organizationId, query.accountId);

    const curve = buildEquityCurve(
      trades
        .filter((trade) => trade.closedAt !== null)
        .map((trade) => ({
          at: trade.closedAt!,
          netPnl: trade.netPnl.toString(),
          reference: trade.id,
        })),
      startingBalance,
    );

    return {
      startingBalance: curve.startingBalance.toString(),
      endingEquity: curve.endingEquity.toString(),
      peakEquity: curve.peakEquity.toString(),
      maxDrawdown: curve.maxDrawdown.toString(),
      maxDrawdownPercent: ratio(curve.maxDrawdownPercent),
      maxDrawdownAt: curve.maxDrawdownAt?.toISOString() ?? null,
      points: curve.points.map((point) => ({
        at: point.at.toISOString(),
        reference: point.reference,
        equity: point.equity.toString(),
        cumulativePnl: point.cumulativePnl.toString(),
        drawdown: point.drawdown.toString(),
        drawdownPercent: ratio(point.drawdownPercent),
      })),
    };
  }

  async overview(organizationId: string, query: AnalyticsQuery): Promise<DashboardOverview> {
    const [trades, equityCurve, openTradeCount] = await Promise.all([
      this.fetch(organizationId, query),
      this.equityCurve(organizationId, query),
      this.prisma.trade.count({
        where: {
          organizationId,
          deletedAt: null,
          status: 'OPEN',
          ...(query.accountId ? { accountId: query.accountId } : {}),
        },
      }),
    ]);

    const recent = [...trades]
      .filter((trade) => trade.closedAt !== null)
      .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime())
      .slice(0, 10);

    return {
      summary: serializeSummary(summarizePerformance(trades.map(toMetricInput))),
      equityCurve,
      recentTrades: recent.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        netPnl: trade.netPnl.toString(),
        rMultiple: trade.rMultiple?.toString() ?? null,
        closedAt: trade.closedAt?.toISOString() ?? null,
      })),
      openTradeCount,
    };
  }

  /**
   * The month grid. Reads the cached TradingDay totals rather than
   * re-aggregating trades, which is what keeps the calendar a single query.
   */
  async calendar(
    organizationId: string,
    from: string,
    to: string,
    accountId?: string,
  ): Promise<CalendarResponse> {
    const [days, timezone] = await Promise.all([
      this.prisma.tradingDay.findMany({
        where: {
          organizationId,
          ...(accountId ? { accountId } : {}),
          date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
        },
        orderBy: { date: 'asc' },
      }),
      this.accountTimezone(organizationId, accountId),
    ]);

    // Several accounts can contribute to the same calendar day, so rows are
    // folded together before they reach the grid.
    const byDate = new Map<
      string,
      {
        netPnl: Decimal;
        tradeCount: number;
        winCount: number;
        lossCount: number;
        hasJournal: boolean;
        isLocked: boolean;
      }
    >();

    for (const day of days) {
      const key = day.date.toISOString().slice(0, 10);
      const existing = byDate.get(key);
      const netPnl = new Decimal(day.netPnl.toString());
      const hasJournal = Boolean(day.plan?.trim() || day.review?.trim());

      if (existing) {
        existing.netPnl = existing.netPnl.plus(netPnl);
        existing.tradeCount += day.tradeCount;
        existing.winCount += day.winCount;
        existing.lossCount += day.lossCount;
        existing.hasJournal ||= hasJournal;
        existing.isLocked ||= day.isLocked !== null;
      } else {
        byDate.set(key, {
          netPnl,
          tradeCount: day.tradeCount,
          winCount: day.winCount,
          lossCount: day.lossCount,
          hasJournal,
          isLocked: day.isLocked !== null,
        });
      }
    }

    const allDays = tradingDayRange(from, to).map((date) => {
      const row = byDate.get(date);
      return {
        date,
        netPnl: (row?.netPnl ?? new Decimal(0)).toString(),
        tradeCount: row?.tradeCount ?? 0,
        winCount: row?.winCount ?? 0,
        lossCount: row?.lossCount ?? 0,
        hasJournal: row?.hasJournal ?? false,
        isLocked: row?.isLocked ?? false,
      };
    });

    // Weeks start on Monday, which is where a trading week starts.
    const weeks: CalendarResponse['weeks'] = [];
    let current: { startDate: string; netPnl: Decimal; tradeCount: number } | null = null;

    for (const day of allDays) {
      const weekday = new Date(`${day.date}T00:00:00.000Z`).getUTCDay();
      const isMonday = weekday === 1;

      if (!current || isMonday) {
        if (current) {
          weeks.push({
            startDate: current.startDate,
            netPnl: current.netPnl.toString(),
            tradeCount: current.tradeCount,
          });
        }
        current = { startDate: day.date, netPnl: new Decimal(0), tradeCount: 0 };
      }

      current.netPnl = current.netPnl.plus(day.netPnl);
      current.tradeCount += day.tradeCount;
    }

    if (current) {
      weeks.push({
        startDate: current.startDate,
        netPnl: current.netPnl.toString(),
        tradeCount: current.tradeCount,
      });
    }

    return { from, to, timezone, days: allDays, weeks };
  }

  /**
   * Groups closed trades along one dimension and summarises each bucket.
   *
   * The grouping runs in the application rather than in SQL because every row
   * needs profit factor and average R, which are ratios of conditional sums —
   * expressible in SQL, but only as a query that has to be kept in step with
   * the definitions in @bmz/core. One source of truth is worth the round trip
   * at this data size.
   */
  async breakdown(
    organizationId: string,
    dimension: BreakdownDimension,
    query: AnalyticsQuery,
  ): Promise<BreakdownResponse> {
    const trades = await this.fetch(organizationId, query);
    const timezone = await this.accountTimezone(organizationId, query.accountId);

    const buckets = new Map<string, { label: string; trades: AnalyticsTrade[] }>();

    const put = (key: string, label: string, trade: AnalyticsTrade) => {
      const bucket = buckets.get(key);
      if (bucket) bucket.trades.push(trade);
      else buckets.set(key, { label, trades: [trade] });
    };

    if (dimension === 'tag' || dimension === 'playbook') {
      await this.bucketByRelation(organizationId, dimension, trades, put);
    } else {
      for (const trade of trades) {
        const { key, label } = this.bucketFor(dimension, trade, timezone);
        put(key, label, trade);
      }
    }

    const rows: BreakdownRow[] = [...buckets.entries()].map(([key, bucket]) => {
      const summary = summarizePerformance(bucket.trades.map(toMetricInput));
      return {
        key,
        label: bucket.label,
        tradeCount: summary.tradeCount,
        netPnl: money(summary.netPnl)!,
        winRate: ratio(summary.winRate),
        profitFactor: ratio(summary.profitFactor),
        averageRMultiple: ratio(summary.averageRMultiple),
      };
    });

    rows.sort((a, b) => new Decimal(b.netPnl).comparedTo(new Decimal(a.netPnl)));
    return { dimension, rows };
  }

  private bucketFor(
    dimension: BreakdownDimension,
    trade: AnalyticsTrade,
    timezone: string,
  ): { key: string; label: string } {
    switch (dimension) {
      case 'symbol':
        return { key: trade.symbol, label: trade.symbol };
      case 'instrumentClass':
        return { key: trade.instrumentClass, label: titleCase(trade.instrumentClass) };
      case 'direction':
        return { key: trade.direction, label: titleCase(trade.direction) };
      case 'dayOfWeek': {
        const day = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long',
        }).format(trade.openedAt);
        return { key: day, label: day };
      }
      case 'hourOfDay': {
        const hour = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          hour12: false,
        }).format(trade.openedAt);
        return { key: hour, label: `${hour}:00` };
      }
      case 'duration': {
        const bucket = durationBucket(trade.durationMs === null ? null : Number(trade.durationMs));
        return { key: bucket, label: bucket };
      }
      default:
        return { key: 'all', label: 'All' };
    }
  }

  private async bucketByRelation(
    organizationId: string,
    dimension: 'tag' | 'playbook',
    trades: AnalyticsTrade[],
    put: (key: string, label: string, trade: AnalyticsTrade) => void,
  ): Promise<void> {
    const byId = new Map(trades.map((trade) => [trade.id, trade]));

    if (dimension === 'playbook') {
      const playbooks = await this.prisma.playbook.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      });
      const names = new Map(playbooks.map((playbook) => [playbook.id, playbook.name]));

      for (const trade of trades) {
        if (trade.playbookId) {
          put(trade.playbookId, names.get(trade.playbookId) ?? 'Unknown playbook', trade);
        } else {
          // Trades taken outside any playbook are their own bucket — that
          // comparison is usually the point of the report.
          put('none', 'No playbook', trade);
        }
      }
      return;
    }

    const links = await this.prisma.tradeTag.findMany({
      where: { tradeId: { in: [...byId.keys()] } },
      select: { tradeId: true, tag: { select: { id: true, name: true } } },
    });

    const tagged = new Set<string>();
    for (const link of links) {
      const trade = byId.get(link.tradeId);
      if (!trade) continue;
      tagged.add(link.tradeId);
      // A trade with three tags counts once in each bucket, so the rows sum to
      // more than the trade count by design.
      put(link.tag.id, link.tag.name, trade);
    }

    for (const trade of trades) {
      if (!tagged.has(trade.id)) put('none', 'Untagged', trade);
    }
  }

  private async fetch(organizationId: string, query: AnalyticsQuery): Promise<AnalyticsTrade[]> {
    const where: Prisma.TradeWhereInput = { organizationId, deletedAt: null };

    if (query.accountId) where.accountId = query.accountId;
    if (query.direction) where.direction = query.direction;
    if (query.playbookId) where.playbookId = query.playbookId;
    if (query.symbols?.length) where.symbol = { in: query.symbols };
    if (query.instrumentClasses?.length) where.instrumentClass = { in: query.instrumentClasses };
    if (query.tagIds?.length)
      where.AND = query.tagIds.map((tagId) => ({ tags: { some: { tagId } } }));

    if (query.from || query.to) {
      where.tradingDay = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
      };
    }

    return this.prisma.trade.findMany({
      where,
      select: analyticsSelect,
      orderBy: { openedAt: 'asc' },
    });
  }

  private async startingBalance(organizationId: string, accountId?: string): Promise<string> {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, deletedAt: null, ...(accountId ? { id: accountId } : {}) },
      select: { startingBalance: true },
    });

    return accounts
      .reduce((total, account) => total.plus(account.startingBalance.toString()), new Decimal(0))
      .toString();
  }

  private async accountTimezone(organizationId: string, accountId?: string): Promise<string> {
    if (accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: accountId, organizationId },
        select: { timezone: true },
      });
      if (account) return account.timezone;
    }

    const first = await this.prisma.account.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { timezone: true },
    });

    return first?.timezone ?? 'UTC';
  }
}

function toMetricInput(trade: AnalyticsTrade): TradeMetricInput {
  return {
    id: trade.id,
    netPnl: trade.netPnl.toString(),
    fees: trade.fees.toString(),
    rMultiple: trade.rMultiple?.toString() ?? null,
    closedAt: trade.closedAt,
    durationMs: trade.durationMs === null ? null : Number(trade.durationMs),
  };
}

/**
 * Ratios are exact Decimals internally, which means a division like 11/24
 * carries 28 significant digits. Nothing downstream needs that: six decimal
 * places is finer than any chart or table renders, and it keeps payloads
 * readable. Money keeps the six places its column stores.
 */
const RATIO_PRECISION = 6;
const MONEY_PRECISION = 6;

function money(value: Decimal | null): string | null {
  return value === null ? null : value.toDecimalPlaces(MONEY_PRECISION).toString();
}

function ratio(value: Decimal | null): string | null {
  return value === null ? null : value.toDecimalPlaces(RATIO_PRECISION).toString();
}

function serializeSummary(summary: ReturnType<typeof summarizePerformance>): PerformanceSummary {
  return {
    tradeCount: summary.tradeCount,
    wins: summary.wins,
    losses: summary.losses,
    breakEven: summary.breakEven,
    winRate: ratio(summary.winRate),
    grossProfit: money(summary.grossProfit)!,
    grossLoss: money(summary.grossLoss)!,
    netPnl: money(summary.netPnl)!,
    totalFees: money(summary.totalFees)!,
    profitFactor: ratio(summary.profitFactor),
    averageWin: money(summary.averageWin),
    averageLoss: money(summary.averageLoss),
    payoffRatio: ratio(summary.payoffRatio),
    expectancy: money(summary.expectancy),
    largestWin: money(summary.largestWin),
    largestLoss: money(summary.largestLoss),
    averageRMultiple: ratio(summary.averageRMultiple),
    totalR: ratio(summary.totalR),
    averageDurationMs: summary.averageDurationMs,
    longestWinStreak: summary.longestWinStreak,
    longestLossStreak: summary.longestLossStreak,
    currentStreak: summary.currentStreak,
  };
}

export function durationBucket(durationMs: number | null): string {
  if (durationMs === null) return 'Still open';
  const minutes = durationMs / 60_000;
  if (minutes < 1) return 'Under a minute';
  if (minutes < 5) return '1-5 minutes';
  if (minutes < 30) return '5-30 minutes';
  if (minutes < 120) return '30 minutes - 2 hours';
  if (minutes < 1440) return '2 hours - 1 day';
  if (minutes < 10080) return '1-7 days';
  return 'Over a week';
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export { safeDivide, tradingDayKey };
