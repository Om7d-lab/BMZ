import { z } from 'zod';
import {
  cuid,
  decimalString,
  instrumentClass,
  isoDate,
  isoDateTime,
  tradeDirection,
} from './common.js';

/** The filter every dashboard, report and summary endpoint accepts. */
export const analyticsQuery = z.object({
  accountId: cuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  symbols: z.array(z.string().trim().toUpperCase()).optional(),
  instrumentClasses: z.array(instrumentClass).optional(),
  direction: tradeDirection.optional(),
  playbookId: cuid.optional(),
  tagIds: z.array(cuid).optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

export const performanceSummary = z.object({
  tradeCount: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  breakEven: z.number().int(),
  /** Null when no trade has resolved yet, rather than a misleading zero. */
  winRate: decimalString.nullable(),
  grossProfit: decimalString,
  grossLoss: decimalString,
  netPnl: decimalString,
  totalFees: decimalString,
  profitFactor: decimalString.nullable(),
  averageWin: decimalString.nullable(),
  averageLoss: decimalString.nullable(),
  payoffRatio: decimalString.nullable(),
  expectancy: decimalString.nullable(),
  largestWin: decimalString.nullable(),
  largestLoss: decimalString.nullable(),
  averageRMultiple: decimalString.nullable(),
  totalR: decimalString.nullable(),
  averageDurationMs: z.number().int().nullable(),
  longestWinStreak: z.number().int(),
  longestLossStreak: z.number().int(),
  currentStreak: z
    .object({ outcome: z.enum(['WIN', 'LOSS', 'BREAKEVEN']), length: z.number().int() })
    .nullable(),
});
export type PerformanceSummary = z.infer<typeof performanceSummary>;

export const equityPoint = z.object({
  at: isoDateTime,
  reference: z.string().nullable(),
  equity: decimalString,
  cumulativePnl: decimalString,
  drawdown: decimalString,
  drawdownPercent: decimalString.nullable(),
});
export type EquityPoint = z.infer<typeof equityPoint>;

export const equityCurve = z.object({
  startingBalance: decimalString,
  endingEquity: decimalString,
  peakEquity: decimalString,
  maxDrawdown: decimalString,
  maxDrawdownPercent: decimalString.nullable(),
  maxDrawdownAt: isoDateTime.nullable(),
  points: z.array(equityPoint),
});
export type EquityCurve = z.infer<typeof equityCurve>;

export const calendarDay = z.object({
  date: isoDate,
  netPnl: decimalString,
  tradeCount: z.number().int(),
  winCount: z.number().int(),
  lossCount: z.number().int(),
  hasJournal: z.boolean(),
  isLocked: z.boolean(),
});
export type CalendarDay = z.infer<typeof calendarDay>;

export const calendarResponse = z.object({
  from: isoDate,
  to: isoDate,
  timezone: z.string(),
  days: z.array(calendarDay),
  /** Week-number keyed totals for the calendar's right-hand rail. */
  weeks: z.array(
    z.object({
      startDate: isoDate,
      netPnl: decimalString,
      tradeCount: z.number().int(),
    }),
  ),
});
export type CalendarResponse = z.infer<typeof calendarResponse>;

/** One row of a grouped breakdown: by symbol, tag, day of week, hour, playbook. */
export const breakdownRow = z.object({
  key: z.string(),
  label: z.string(),
  tradeCount: z.number().int(),
  netPnl: decimalString,
  winRate: decimalString.nullable(),
  profitFactor: decimalString.nullable(),
  averageRMultiple: decimalString.nullable(),
});
export type BreakdownRow = z.infer<typeof breakdownRow>;

export const breakdownDimension = z.enum([
  'symbol',
  'instrumentClass',
  'direction',
  'tag',
  'playbook',
  'dayOfWeek',
  'hourOfDay',
  'duration',
]);
export type BreakdownDimension = z.infer<typeof breakdownDimension>;

export const breakdownResponse = z.object({
  dimension: breakdownDimension,
  rows: z.array(breakdownRow),
});
export type BreakdownResponse = z.infer<typeof breakdownResponse>;

export const dashboardOverview = z.object({
  summary: performanceSummary,
  equityCurve,
  recentTrades: z.array(
    z.object({
      id: cuid,
      symbol: z.string(),
      direction: tradeDirection,
      netPnl: decimalString,
      rMultiple: decimalString.nullable(),
      closedAt: isoDateTime.nullable(),
    }),
  ),
  openTradeCount: z.number().int(),
});
export type DashboardOverview = z.infer<typeof dashboardOverview>;
