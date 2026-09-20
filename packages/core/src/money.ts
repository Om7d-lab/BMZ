import DecimalDefault from 'decimal.js';
import type { Decimal as DecimalInstance } from 'decimal.js';

/**
 * decimal.js publishes an ESM entry point with only a default export, while
 * its type declarations expose the class as a named export merged with a
 * namespace and a call signature. TypeScript consequently reads the default
 * import as callable but not constructable, which is wrong — it is the
 * constructor. The interface below states the surface this package actually
 * uses, and the cast on the next line is the single place that mismatch is
 * reconciled for every consumer.
 */
interface DecimalConstructor {
  new (value: DecimalInstance | number | string): DecimalInstance;
  set(config: { precision?: number; rounding?: number }): void;
  min(...values: Array<DecimalInstance | number | string>): DecimalInstance;
  max(...values: Array<DecimalInstance | number | string>): DecimalInstance;
  readonly ROUND_HALF_EVEN: 6;
}

export type Decimal = DecimalInstance;
export const Decimal = DecimalDefault as unknown as DecimalConstructor;

// Trading maths needs more headroom than a float and exact decimal rounding.
// 28 significant digits comfortably covers crypto quantities (8+ dp) and
// forex prices (5 dp) without ever hitting binary representation error.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

/** Anything we are willing to coerce into a Decimal. */
export type Numeric = Decimal | number | string;

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);

export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Decimal) return value;
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new RangeError(`Expected a finite number, received "${String(value)}"`);
  }
  return d;
}

export function sum(values: readonly Numeric[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(dec(value)), ZERO);
}

/**
 * Quantises a money amount to the currency's minor unit. Most currencies use
 * two decimals; the exceptions below are the ones a trader is realistically
 * going to hold an account in.
 */
const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  BHD: 3,
  CLP: 0,
  IQD: 3,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  OMR: 3,
  TND: 3,
  VND: 0,
};

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

export function roundMoney(value: Numeric, currency = 'USD'): Decimal {
  return dec(value).toDecimalPlaces(currencyDecimals(currency), Decimal.ROUND_HALF_EVEN);
}

/**
 * Division that yields null instead of Infinity or NaN. Every ratio in this
 * package routes through here so a zero denominator surfaces as "not
 * applicable" rather than a poisoned number on a dashboard.
 */
export function safeDivide(numerator: Numeric, denominator: Numeric): Decimal | null {
  const d = dec(denominator);
  if (d.isZero()) return null;
  return dec(numerator).dividedBy(d);
}

/** Serialises a Decimal for JSON transport without losing precision. */
export function toFixedString(value: Numeric, decimalPlaces: number): string {
  return dec(value).toFixed(decimalPlaces, Decimal.ROUND_HALF_EVEN);
}
