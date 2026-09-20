import { Decimal, dec, type Numeric } from '@bmz/core';
import { Prisma } from '../generated/prisma/client.js';

/**
 * The boundary between Prisma's Decimal, the domain's Decimal and the strings
 * that travel over the wire. Nothing in the API turns a money value into a
 * JavaScript number; these four functions are the only conversions there are.
 */

/** Prisma Decimal (or null) into the domain's Decimal. */
export function fromPrisma(value: Prisma.Decimal | null | undefined): Decimal {
  return value === null || value === undefined ? new Decimal(0) : new Decimal(value.toString());
}

export function fromPrismaNullable(value: Prisma.Decimal | null | undefined): Decimal | null {
  return value === null || value === undefined ? null : new Decimal(value.toString());
}

/** Domain Decimal into the value Prisma writes to a numeric column. */
export function toPrisma(value: Numeric | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(dec(value).toString());
}

/** Anything decimal-ish into the string the API sends. */
export function toApi(value: Numeric | Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

/** Same, but for a column that is never null. */
export function toApiRequired(value: Numeric | Prisma.Decimal): string {
  return value.toString();
}
