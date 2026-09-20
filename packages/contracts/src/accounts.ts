import { z } from 'zod';
import {
  accountType,
  currencyCode,
  cuid,
  decimalString,
  instrumentClass,
  isoDateTime,
  timezone,
} from './common.js';

export const account = z.object({
  id: cuid,
  name: z.string(),
  type: accountType,
  broker: z.string().nullable(),
  currency: z.string(),
  startingBalance: decimalString,
  timezone: z.string(),
  isArchived: z.boolean(),
  createdAt: isoDateTime,
  /** Denormalised for the account switcher. */
  tradeCount: z.number().int().nonnegative().optional(),
  netPnl: decimalString.optional(),
  currentBalance: decimalString.optional(),
});
export type Account = z.infer<typeof account>;

export const createAccountRequest = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountType.default('LIVE'),
  broker: z.string().trim().max(80).nullable().optional(),
  accountNumber: z.string().trim().max(80).nullable().optional(),
  currency: currencyCode.default('USD'),
  startingBalance: decimalString.default('0'),
  timezone: timezone.default('UTC'),
});
export type CreateAccountRequest = z.infer<typeof createAccountRequest>;

export const updateAccountRequest = createAccountRequest.partial().extend({
  isArchived: z.boolean().optional(),
});
export type UpdateAccountRequest = z.infer<typeof updateAccountRequest>;

export const instrument = z.object({
  id: cuid,
  symbol: z.string(),
  instrumentClass,
  description: z.string().nullable(),
  exchange: z.string().nullable(),
  currency: z.string(),
  multiplier: decimalString.nullable(),
  tickSize: decimalString.nullable(),
  pricePrecision: z.number().int().nullable(),
});
export type Instrument = z.infer<typeof instrument>;

export const upsertInstrumentRequest = z.object({
  symbol: z.string().trim().min(1).max(40).toUpperCase(),
  instrumentClass,
  description: z.string().trim().max(200).nullable().optional(),
  exchange: z.string().trim().max(40).nullable().optional(),
  currency: currencyCode.default('USD'),
  multiplier: decimalString.nullable().optional(),
  tickSize: decimalString.nullable().optional(),
  pricePrecision: z.number().int().min(0).max(12).nullable().optional(),
});
export type UpsertInstrumentRequest = z.infer<typeof upsertInstrumentRequest>;
