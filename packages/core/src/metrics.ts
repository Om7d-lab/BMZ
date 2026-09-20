import { Decimal, dec, safeDivide, ZERO, type Numeric } from './money.js';

/** The minimum a trade must expose for the performance maths to run. */
export interface TradeMetricInput {
  id: string;
  netPnl: Numeric;
  fees?: Numeric | null;
  rMultiple?: Numeric | null;
  /** When the trade was closed. Open trades are excluded from performance. */
  closedAt: Date | null;
  durationMs?: number | null;
}

export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN';

export function classifyOutcome(netPnl: Numeric): TradeOutcome {
  const value = dec(netPnl);
  if (value.greaterThan(0)) return 'WIN';
  if (value.lessThan(0)) return 'LOSS';
  return 'BREAKEVEN';
}

export interface PerformanceSummary {
  tradeCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  /** Wins over decisive trades. Break-even trades are excluded from the base. */
  winRate: Decimal | null;
  grossProfit: Decimal;
  grossLoss: Decimal;
  netPnl: Decimal;
  totalFees: Decimal;
  /** Gross profit over gross loss. Null when there are no losses to divide by. */
  profitFactor: Decimal | null;
  averageWin: Decimal | null;
  averageLoss: Decimal | null;
  /** Average win over average loss, both taken as positive magnitudes. */
  payoffRatio: Decimal | null;
  /** Expected P&L per trade, from this sample's win rate and average outcomes. */
  expectancy: Decimal | null;
  largestWin: Decimal | null;
  largestLoss: Decimal | null;
  averageRMultiple: Decimal | null;
  totalR: Decimal | null;
  averageDurationMs: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: { outcome: TradeOutcome; length: number } | null;
}

/**
 * Performance across a set of trades. Only closed trades are counted — an open
 * position has no realised result, and including it would let a trader flatter
 * their own statistics by leaving losers running.
 */
export function summarizePerformance(trades: readonly TradeMetricInput[]): PerformanceSummary {
  const closed = trades
    .filter((trade) => trade.closedAt !== null)
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  let grossProfit = ZERO;
  let grossLoss = ZERO;
  let netPnl = ZERO;
  let totalFees = ZERO;
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let largestWin: Decimal | null = null;
  let largestLoss: Decimal | null = null;
  let durationTotal = 0;
  let durationCount = 0;
  let rTotal = ZERO;
  let rCount = 0;

  for (const trade of closed) {
    const value = dec(trade.netPnl);
    netPnl = netPnl.plus(value);
    totalFees = totalFees.plus(dec(trade.fees ?? 0));

    const outcome = classifyOutcome(value);
    if (outcome === 'WIN') {
      wins += 1;
      grossProfit = grossProfit.plus(value);
      if (!largestWin || value.greaterThan(largestWin)) largestWin = value;
    } else if (outcome === 'LOSS') {
      losses += 1;
      grossLoss = grossLoss.plus(value.abs());
      if (!largestLoss || value.lessThan(largestLoss)) largestLoss = value;
    } else {
      breakEven += 1;
    }

    if (trade.rMultiple !== null && trade.rMultiple !== undefined) {
      rTotal = rTotal.plus(dec(trade.rMultiple));
      rCount += 1;
    }

    if (typeof trade.durationMs === 'number' && Number.isFinite(trade.durationMs)) {
      durationTotal += trade.durationMs;
      durationCount += 1;
    }
  }

  const decisive = wins + losses;
  const winRate = safeDivide(wins, decisive);
  const averageWin = safeDivide(grossProfit, wins);
  const averageLoss = safeDivide(grossLoss, losses);

  // Expectancy uses the decisive-trade base so it reads as "per trade that
  // resolved", consistent with the win rate shown beside it.
  let expectancy: Decimal | null = null;
  if (winRate && averageWin && averageLoss) {
    const lossRate = new Decimal(1).minus(winRate);
    expectancy = winRate.times(averageWin).minus(lossRate.times(averageLoss));
  } else if (decisive > 0) {
    expectancy = safeDivide(netPnl, decisive);
  }

  const streaks = computeStreaks(closed.map((trade) => classifyOutcome(trade.netPnl)));

  return {
    tradeCount: closed.length,
    wins,
    losses,
    breakEven,
    winRate,
    grossProfit,
    grossLoss,
    netPnl,
    totalFees,
    profitFactor: safeDivide(grossProfit, grossLoss),
    averageWin,
    averageLoss,
    payoffRatio: averageWin && averageLoss ? safeDivide(averageWin, averageLoss) : null,
    expectancy,
    largestWin,
    largestLoss,
    averageRMultiple: rCount > 0 ? rTotal.dividedBy(rCount) : null,
    totalR: rCount > 0 ? rTotal : null,
    averageDurationMs: durationCount > 0 ? Math.round(durationTotal / durationCount) : null,
    ...streaks,
  };
}

interface StreakResult {
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: { outcome: TradeOutcome; length: number } | null;
}

/**
 * Streaks over outcomes in chronological order. Break-even trades neither
 * extend nor break a streak — they are noise, not a result.
 */
export function computeStreaks(outcomes: readonly TradeOutcome[]): StreakResult {
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runOutcome: TradeOutcome | null = null;
  let runLength = 0;

  for (const outcome of outcomes) {
    if (outcome === 'BREAKEVEN') continue;

    if (outcome === runOutcome) {
      runLength += 1;
    } else {
      runOutcome = outcome;
      runLength = 1;
    }

    if (outcome === 'WIN') {
      longestWinStreak = Math.max(longestWinStreak, runLength);
    } else {
      longestLossStreak = Math.max(longestLossStreak, runLength);
    }
  }

  return {
    longestWinStreak,
    longestLossStreak,
    currentStreak: runOutcome ? { outcome: runOutcome, length: runLength } : null,
  };
}
