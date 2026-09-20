import { Decimal, dec, safeDivide, sum, ZERO, type Numeric } from './money.js';
import { resolveMultiplier, type InstrumentClass } from './instruments.js';

export type ExecutionSide = 'BUY' | 'SELL';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED';

export interface ExecutionInput {
  id: string;
  side: ExecutionSide;
  /** Always positive. Direction is carried by `side`, never by the sign. */
  quantity: Numeric;
  price: Numeric;
  /** Commission, exchange and regulatory fees. Positive means a cost. */
  fees?: Numeric | null;
  executedAt: Date;
}

/** One FIFO pairing of an opening execution against a closing execution. */
export interface RealizedMatch {
  openExecutionId: string;
  closeExecutionId: string;
  quantity: Decimal;
  entryPrice: Decimal;
  exitPrice: Decimal;
  direction: TradeDirection;
  /** Before fees — fees are accounted for at trade level, not per match. */
  grossPnl: Decimal;
  openedAt: Date;
  closedAt: Date;
}

export interface TradeComputationOptions {
  instrumentClass: InstrumentClass;
  symbol?: string;
  /** Explicit contract multiplier from the instrument record. */
  multiplier?: Numeric | null;
  /** Initial stop, used to derive the R-multiple. */
  stopLoss?: Numeric | null;
  /** Initial target, used to derive the planned reward:risk. */
  takeProfit?: Numeric | null;
}

export interface TradeComputation {
  direction: TradeDirection;
  status: TradeStatus;
  multiplier: Decimal;
  /** Largest absolute position size the trade ever carried. */
  peakQuantity: Decimal;
  /** Quantity still open; zero for a closed trade. */
  openQuantity: Decimal;
  /** Quantity that has been closed out. */
  closedQuantity: Decimal;
  averageEntryPrice: Decimal | null;
  averageExitPrice: Decimal | null;
  grossPnl: Decimal;
  fees: Decimal;
  netPnl: Decimal;
  /** Net P&L as a fraction of capital committed at entry, e.g. 0.042 = 4.2%. */
  netReturn: Decimal | null;
  initialRisk: Decimal | null;
  rMultiple: Decimal | null;
  plannedRewardRisk: Decimal | null;
  openedAt: Date;
  closedAt: Date | null;
  durationMs: number | null;
  /** Number of times the position crossed through flat into the other side. */
  reversals: number;
  matches: RealizedMatch[];
}

interface OpenLot {
  executionId: string;
  quantity: Decimal;
  price: Decimal;
  openedAt: Date;
}

function sideDirection(side: ExecutionSide): TradeDirection {
  return side === 'BUY' ? 'LONG' : 'SHORT';
}

/**
 * Reduces a list of executions into a single trade using FIFO lot matching.
 *
 * FIFO is the convention brokers report under and the one traders expect to
 * see reproduced in a journal, so it is what we realise P&L with. Fees are
 * summed across every execution and subtracted once at the trade level rather
 * than smeared across matches, which keeps `grossPnl` comparable between a
 * commission-free account and a per-contract futures account.
 *
 * A position that trades through flat (long 2, then sell 3) realises the close
 * and opens the remainder on the other side, counted in `reversals`. The
 * trade's reported `direction` stays the one it opened with.
 */
export function computeTrade(
  executions: readonly ExecutionInput[],
  options: TradeComputationOptions,
): TradeComputation {
  if (executions.length === 0) {
    throw new RangeError('A trade needs at least one execution');
  }

  const ordered = [...executions].sort((a, b) => {
    const byTime = a.executedAt.getTime() - b.executedAt.getTime();
    // Ties break on id so the same input always produces the same matches.
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });

  const first = ordered[0]!;
  const direction = sideDirection(first.side);
  const multiplier = resolveMultiplier({
    instrumentClass: options.instrumentClass,
    ...(options.symbol !== undefined ? { symbol: options.symbol } : {}),
    override: options.multiplier ?? null,
  });

  const lots: OpenLot[] = [];
  const matches: RealizedMatch[] = [];

  let grossPnl = ZERO;
  let peakQuantity = ZERO;
  let reversals = 0;
  let closedQuantity = ZERO;
  let entryNotional = ZERO;
  let entryQuantity = ZERO;
  let exitNotional = ZERO;
  let exitQuantity = ZERO;

  for (const execution of ordered) {
    let remaining = dec(execution.quantity);
    if (remaining.lessThanOrEqualTo(0)) {
      throw new RangeError(`Execution ${execution.id} must have a positive quantity`);
    }
    const price = dec(execution.price);

    // An execution closes existing lots only when it opposes the side those
    // lots were opened on.
    const openSide: ExecutionSide | null =
      lots.length > 0 ? (lots[0]!.quantity.greaterThan(0) ? 'BUY' : 'SELL') : null;
    const isClosing = openSide !== null && openSide !== execution.side;

    if (isClosing) {
      const lotDirection = sideDirection(openSide);
      while (remaining.greaterThan(0) && lots.length > 0) {
        const lot = lots[0]!;
        const lotQuantity = lot.quantity.abs();
        const matched = Decimal.min(lotQuantity, remaining);

        // Long: profit when the exit is above the entry. Short: the reverse.
        const perUnit = lotDirection === 'LONG' ? price.minus(lot.price) : lot.price.minus(price);
        const matchGross = perUnit.times(matched).times(multiplier);

        grossPnl = grossPnl.plus(matchGross);
        closedQuantity = closedQuantity.plus(matched);
        exitNotional = exitNotional.plus(price.times(matched));
        exitQuantity = exitQuantity.plus(matched);

        matches.push({
          openExecutionId: lot.executionId,
          closeExecutionId: execution.id,
          quantity: matched,
          entryPrice: lot.price,
          exitPrice: price,
          direction: lotDirection,
          grossPnl: matchGross,
          openedAt: lot.openedAt,
          closedAt: execution.executedAt,
        });

        remaining = remaining.minus(matched);
        if (lotQuantity.minus(matched).isZero()) {
          lots.shift();
        } else {
          const signed =
            lotDirection === 'LONG'
              ? lotQuantity.minus(matched)
              : lotQuantity.minus(matched).negated();
          lots[0] = { ...lot, quantity: signed };
        }
      }

      // Anything left over flips the position to the other side.
      if (remaining.greaterThan(0)) {
        reversals += 1;
      }
    }

    if (remaining.greaterThan(0)) {
      const signed = execution.side === 'BUY' ? remaining : remaining.negated();
      lots.push({
        executionId: execution.id,
        quantity: signed,
        price,
        openedAt: execution.executedAt,
      });
      entryNotional = entryNotional.plus(price.times(remaining));
      entryQuantity = entryQuantity.plus(remaining);
    }

    const openNow = lots.reduce<Decimal>((total, lot) => total.plus(lot.quantity.abs()), ZERO);
    if (openNow.greaterThan(peakQuantity)) peakQuantity = openNow;
  }

  const openQuantity = lots.reduce<Decimal>((total, lot) => total.plus(lot.quantity.abs()), ZERO);
  const status: TradeStatus = openQuantity.isZero() ? 'CLOSED' : 'OPEN';

  const fees = sum(ordered.map((execution) => dec(execution.fees ?? 0)));
  const netPnl = grossPnl.minus(fees);

  const averageEntryPrice = safeDivide(entryNotional, entryQuantity);
  const averageExitPrice = safeDivide(exitNotional, exitQuantity);

  const lastExecution = ordered[ordered.length - 1]!;
  const closedAt = status === 'CLOSED' ? lastExecution.executedAt : null;
  const openedAt = first.executedAt;
  const durationMs = closedAt ? closedAt.getTime() - openedAt.getTime() : null;

  // Risk is measured against the position the trade actually carried, so a
  // scaled-in entry is risked at its average price across peak size.
  let initialRisk: Decimal | null = null;
  let rMultiple: Decimal | null = null;
  let plannedRewardRisk: Decimal | null = null;

  if (options.stopLoss !== null && options.stopLoss !== undefined && averageEntryPrice) {
    const stop = dec(options.stopLoss);
    const riskPerUnit = averageEntryPrice.minus(stop).abs();
    const risk = riskPerUnit.times(peakQuantity).times(multiplier);
    if (risk.greaterThan(0)) {
      initialRisk = risk;
      rMultiple = netPnl.dividedBy(risk);
      if (options.takeProfit !== null && options.takeProfit !== undefined) {
        const target = dec(options.takeProfit);
        plannedRewardRisk = safeDivide(target.minus(averageEntryPrice).abs(), riskPerUnit);
      }
    }
  }

  // Capital committed at entry, used for the percentage return.
  const committed = averageEntryPrice
    ? averageEntryPrice.times(peakQuantity).times(multiplier).abs()
    : ZERO;
  const netReturn = safeDivide(netPnl, committed);

  return {
    direction,
    status,
    multiplier,
    peakQuantity,
    openQuantity,
    closedQuantity,
    averageEntryPrice,
    averageExitPrice,
    grossPnl,
    fees,
    netPnl,
    netReturn,
    initialRisk,
    rMultiple,
    plannedRewardRisk,
    openedAt,
    closedAt,
    durationMs,
    reversals,
    matches,
  };
}
