import { Decimal, dec, safeDivide, ZERO, type Numeric } from './money.js';

export interface EquityPointInput {
  at: Date;
  netPnl: Numeric;
  /** Optional label, e.g. the trade id or the trading day. */
  reference?: string;
}

export interface EquityPoint {
  at: Date;
  reference: string | null;
  /** Account value after this point. */
  equity: Decimal;
  /** Cumulative P&L since the starting balance. */
  cumulativePnl: Decimal;
  /** Distance below the running high-water mark, as a positive number. */
  drawdown: Decimal;
  /** Drawdown as a fraction of the high-water mark, e.g. 0.12 = 12%. */
  drawdownPercent: Decimal | null;
}

export interface EquityCurve {
  startingBalance: Decimal;
  points: EquityPoint[];
  endingEquity: Decimal;
  peakEquity: Decimal;
  maxDrawdown: Decimal;
  maxDrawdownPercent: Decimal | null;
  /** When the deepest drawdown was reached. */
  maxDrawdownAt: Date | null;
}

/**
 * Builds a cumulative equity curve and the drawdown series that goes with it.
 *
 * Drawdown is measured against the running high-water mark of equity, not
 * against the starting balance, which is what a trader means when they ask how
 * far they were down from their best.
 */
export function buildEquityCurve(
  entries: readonly EquityPointInput[],
  startingBalance: Numeric = 0,
): EquityCurve {
  const start = dec(startingBalance);
  const ordered = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());

  let equity = start;
  let cumulativePnl = ZERO;
  let peak = start;
  let maxDrawdown = ZERO;
  let maxDrawdownPercent: Decimal | null = null;
  let maxDrawdownAt: Date | null = null;

  const points: EquityPoint[] = [];

  for (const entry of ordered) {
    const value = dec(entry.netPnl);
    equity = equity.plus(value);
    cumulativePnl = cumulativePnl.plus(value);

    if (equity.greaterThan(peak)) peak = equity;

    const drawdown = peak.minus(equity);
    const drawdownPercent = peak.greaterThan(0) ? safeDivide(drawdown, peak) : null;

    if (drawdown.greaterThan(maxDrawdown)) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
      maxDrawdownAt = entry.at;
    }

    points.push({
      at: entry.at,
      reference: entry.reference ?? null,
      equity,
      cumulativePnl,
      drawdown,
      drawdownPercent,
    });
  }

  return {
    startingBalance: start,
    points,
    endingEquity: equity,
    peakEquity: peak,
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownAt,
  };
}

/**
 * Sharpe-style ratio over a series of per-period returns. Returned as null for
 * fewer than two periods, where the standard deviation is meaningless.
 */
export function returnStandardDeviation(returns: readonly Numeric[]): Decimal | null {
  if (returns.length < 2) return null;
  const values = returns.map((value) => dec(value));
  const mean = values
    .reduce<Decimal>((total, value) => total.plus(value), ZERO)
    .dividedBy(values.length);
  const variance = values
    .reduce<Decimal>((total, value) => total.plus(value.minus(mean).pow(2)), ZERO)
    .dividedBy(values.length - 1);
  return new Decimal(Math.sqrt(variance.toNumber()));
}
