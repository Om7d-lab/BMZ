import { z } from 'zod';

/**
 * Money and quantities cross the wire as strings.
 *
 * A JSON number is a float, and a float cannot hold 0.1 + 0.2 or an eight-
 * decimal crypto quantity without drift. Every decimal field in this API is a
 * string on the wire, parsed back into a Decimal at both ends.
 */
export const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'Expected a decimal number, e.g. "1234.56"');

export const positiveDecimalString = decimalString.refine(
  (value) => Number(value) > 0,
  'Must be greater than zero',
);

export const nonNegativeDecimalString = decimalString.refine(
  (value) => Number(value) >= 0,
  'Must not be negative',
);

export const cuid = z.string().min(1).max(64);

/** An ISO-8601 instant. Always stored and transported in UTC. */
export const isoDateTime = z.iso.datetime({ offset: true });

/** A calendar day, `YYYY-MM-DD`, in the account's timezone. */
export const isoDate = z.iso.date();

export const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Expected an IANA timezone, e.g. "Europe/London"');

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Expected a three-letter ISO 4217 currency code');

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex colour, e.g. "#10b981"');

export const instrumentClass = z.enum(['STOCK', 'FUTURES', 'FOREX', 'CRYPTO', 'OPTION']);
export type InstrumentClass = z.infer<typeof instrumentClass>;

export const executionSide = z.enum(['BUY', 'SELL']);
export type ExecutionSide = z.infer<typeof executionSide>;

export const tradeDirection = z.enum(['LONG', 'SHORT']);
export type TradeDirection = z.infer<typeof tradeDirection>;

export const tradeStatus = z.enum(['OPEN', 'CLOSED']);
export type TradeStatus = z.infer<typeof tradeStatus>;

export const reviewStatus = z.enum(['UNREVIEWED', 'NEEDS_REVIEW', 'REVIEWED']);
export type ReviewStatus = z.infer<typeof reviewStatus>;

export const accountType = z.enum(['LIVE', 'PAPER', 'PROP_EVALUATION', 'PROP_FUNDED', 'BACKTEST']);
export type AccountType = z.infer<typeof accountType>;

export const tagCategory = z.enum(['SETUP', 'MISTAKE', 'EMOTION', 'CUSTOM']);
export type TagCategory = z.infer<typeof tagCategory>;

export const membershipRole = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export type MembershipRole = z.infer<typeof membershipRole>;

/** Cursor pagination. Offsets drift while rows are being imported; cursors do not. */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: cuid.optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative().optional(),
  });
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}

/** The shape every error response takes. */
export const apiError = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  /** Field-level validation failures, keyed by dotted path. */
  details: z.record(z.string(), z.array(z.string())).optional(),
});
export type ApiError = z.infer<typeof apiError>;
