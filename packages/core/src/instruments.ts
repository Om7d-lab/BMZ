import { dec, type Numeric, type Decimal } from './money.js';

/** Asset classes the journal understands natively. */
export const INSTRUMENT_CLASSES = ['STOCK', 'FUTURES', 'FOREX', 'CRYPTO', 'OPTION'] as const;
export type InstrumentClass = (typeof INSTRUMENT_CLASSES)[number];

/**
 * Default contract multipliers by asset class.
 *
 * A futures or options position moves by `priceChange * multiplier` per
 * contract, so the multiplier is not cosmetic: getting it wrong scales every
 * downstream number. Equity options are 100 shares per contract by convention;
 * futures vary per product, so the per-symbol value stored on the account's
 * instrument record always wins over this fallback.
 */
const DEFAULT_MULTIPLIERS: Readonly<Record<InstrumentClass, number>> = {
  STOCK: 1,
  FUTURES: 1,
  FOREX: 1,
  CRYPTO: 1,
  OPTION: 100,
};

/**
 * Multipliers for the futures contracts a retail journal sees most often.
 * Keyed by root symbol; resolution strips the month/year suffix first.
 */
const FUTURES_MULTIPLIERS: Readonly<Record<string, number>> = {
  ES: 50, // E-mini S&P 500
  MES: 5, // Micro E-mini S&P 500
  NQ: 20, // E-mini Nasdaq 100
  MNQ: 2, // Micro E-mini Nasdaq 100
  YM: 5, // E-mini Dow
  MYM: 0.5,
  RTY: 50, // E-mini Russell 2000
  M2K: 5,
  CL: 1000, // Crude oil
  MCL: 100,
  GC: 100, // Gold
  MGC: 10,
  SI: 5000, // Silver
  NG: 10000, // Natural gas
  ZB: 1000, // 30-year T-bond
  ZN: 1000, // 10-year T-note
  ZC: 50, // Corn
  ZS: 50, // Soybeans
  '6E': 125000, // Euro FX
  '6J': 12500000, // Japanese yen
};

/** Strips a futures month/year code, e.g. "ESZ5" and "ES 12-25" both give "ES". */
export function futuresRoot(symbol: string): string {
  const cleaned = symbol.toUpperCase().trim();
  const match = /^([A-Z0-9]{1,3}?)(?:[FGHJKMNQUVXZ]\d{1,2}|\s*\d{1,2}-\d{2})$/.exec(cleaned);
  return match?.[1] ?? cleaned;
}

export interface MultiplierLookup {
  instrumentClass: InstrumentClass;
  symbol?: string;
  /** An explicit multiplier from the instrument record, if one is stored. */
  override?: Numeric | null;
}

export function resolveMultiplier({
  instrumentClass,
  symbol,
  override,
}: MultiplierLookup): Decimal {
  if (override !== null && override !== undefined && override !== '') {
    const explicit = dec(override);
    if (explicit.greaterThan(0)) return explicit;
  }
  if (instrumentClass === 'FUTURES' && symbol) {
    const known = FUTURES_MULTIPLIERS[futuresRoot(symbol)];
    if (known !== undefined) return dec(known);
  }
  return dec(DEFAULT_MULTIPLIERS[instrumentClass]);
}

/**
 * Price precision used when displaying a symbol. Forex quotes to 5 decimals,
 * crypto to 8, everything else to 2 unless the instrument record says otherwise.
 */
export function defaultPricePrecision(instrumentClass: InstrumentClass): number {
  switch (instrumentClass) {
    case 'FOREX':
      return 5;
    case 'CRYPTO':
      return 8;
    case 'FUTURES':
      return 4;
    default:
      return 2;
  }
}
