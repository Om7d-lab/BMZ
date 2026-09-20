import { z } from 'zod';
import {
  cuid,
  decimalString,
  executionSide,
  instrumentClass,
  isoDate,
  isoDateTime,
  paginationQuery,
  positiveDecimalString,
  reviewStatus,
  tradeDirection,
  tradeStatus,
} from './common.js';

export const execution = z.object({
  id: cuid,
  side: executionSide,
  quantity: decimalString,
  price: decimalString,
  fees: decimalString,
  executedAt: isoDateTime,
  orderId: z.string().nullable(),
  externalId: z.string().nullable(),
});
export type Execution = z.infer<typeof execution>;

export const executionInput = z.object({
  /** Present when editing an existing fill; absent when adding one. */
  id: cuid.optional(),
  side: executionSide,
  quantity: positiveDecimalString,
  price: decimalString,
  fees: decimalString.default('0'),
  executedAt: isoDateTime,
  orderId: z.string().trim().max(80).nullable().optional(),
});
export type ExecutionInput = z.infer<typeof executionInput>;

export const tradeTag = z.object({
  id: cuid,
  name: z.string(),
  category: z.enum(['SETUP', 'MISTAKE', 'EMOTION', 'CUSTOM']),
  color: z.string().nullable(),
});

export const trade = z.object({
  id: cuid,
  accountId: cuid,
  accountName: z.string().optional(),
  symbol: z.string(),
  instrumentClass,
  direction: tradeDirection,
  status: tradeStatus,

  openedAt: isoDateTime,
  closedAt: isoDateTime.nullable(),
  durationMs: z.number().int().nullable(),
  tradingDay: isoDate.nullable(),

  multiplier: decimalString,
  peakQuantity: decimalString,
  openQuantity: decimalString,
  closedQuantity: decimalString,
  averageEntryPrice: decimalString.nullable(),
  averageExitPrice: decimalString.nullable(),

  stopLoss: decimalString.nullable(),
  takeProfit: decimalString.nullable(),

  grossPnl: decimalString,
  fees: decimalString,
  netPnl: decimalString,
  netReturn: decimalString.nullable(),
  initialRisk: decimalString.nullable(),
  rMultiple: decimalString.nullable(),
  plannedRewardRisk: decimalString.nullable(),

  reviewStatus,
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  playbookId: cuid.nullable(),
  tags: z.array(tradeTag),
  executions: z.array(execution).optional(),
  attachmentCount: z.number().int().nonnegative().optional(),

  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Trade = z.infer<typeof trade>;

export const createTradeRequest = z
  .object({
    accountId: cuid,
    symbol: z.string().trim().min(1).max(40).toUpperCase(),
    instrumentClass,
    /** Overrides the class and symbol defaults from @bmz/core. */
    multiplier: positiveDecimalString.optional(),
    stopLoss: decimalString.nullable().optional(),
    takeProfit: decimalString.nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
    playbookId: cuid.nullable().optional(),
    tagIds: z.array(cuid).max(40).default([]),
    reviewStatus: reviewStatus.optional(),
    executions: z.array(executionInput).min(1, 'A trade needs at least one execution'),
  })
  .refine(
    (value) => {
      // Two fills at the same instant on the same side are almost always a
      // double submit; the FIFO engine would still net them, but the trader
      // meant to enter one.
      const keys = value.executions.map(
        (e) => `${e.side}|${e.executedAt}|${e.price}|${e.quantity}`,
      );
      return new Set(keys).size === keys.length;
    },
    {
      message: 'Two executions are identical; merge them or adjust the timestamp',
      path: ['executions'],
    },
  );
export type CreateTradeRequest = z.infer<typeof createTradeRequest>;

export const updateTradeRequest = z.object({
  symbol: z.string().trim().min(1).max(40).toUpperCase().optional(),
  instrumentClass: instrumentClass.optional(),
  multiplier: positiveDecimalString.nullable().optional(),
  stopLoss: decimalString.nullable().optional(),
  takeProfit: decimalString.nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  playbookId: cuid.nullable().optional(),
  tagIds: z.array(cuid).max(40).optional(),
  reviewStatus: reviewStatus.optional(),
  /** Replaces the whole execution set; omit to leave the fills untouched. */
  executions: z.array(executionInput).min(1).optional(),
});
export type UpdateTradeRequest = z.infer<typeof updateTradeRequest>;

export const tradeSortField = z.enum([
  'openedAt',
  'closedAt',
  'netPnl',
  'rMultiple',
  'symbol',
  'durationMs',
]);

export const listTradesQuery = paginationQuery.extend({
  accountId: cuid.optional(),
  /** Free-text over symbol and notes. */
  search: z.string().trim().max(200).optional(),
  symbols: z.array(z.string().trim().toUpperCase()).optional(),
  instrumentClasses: z.array(instrumentClass).optional(),
  direction: tradeDirection.optional(),
  status: tradeStatus.optional(),
  reviewStatus: reviewStatus.optional(),
  playbookId: cuid.optional(),
  tagIds: z.array(cuid).optional(),
  /** Inclusive, interpreted in the account's timezone. */
  from: isoDate.optional(),
  to: isoDate.optional(),
  minNetPnl: decimalString.optional(),
  maxNetPnl: decimalString.optional(),
  sortBy: tradeSortField.default('openedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListTradesQuery = z.infer<typeof listTradesQuery>;

/** Applies the same change to many trades at once from the list view. */
export const bulkUpdateTradesRequest = z.object({
  tradeIds: z.array(cuid).min(1).max(500),
  reviewStatus: reviewStatus.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  playbookId: cuid.nullable().optional(),
  addTagIds: z.array(cuid).max(40).optional(),
  removeTagIds: z.array(cuid).max(40).optional(),
});
export type BulkUpdateTradesRequest = z.infer<typeof bulkUpdateTradesRequest>;

export const bulkDeleteTradesRequest = z.object({
  tradeIds: z.array(cuid).min(1).max(500),
});
export type BulkDeleteTradesRequest = z.infer<typeof bulkDeleteTradesRequest>;
