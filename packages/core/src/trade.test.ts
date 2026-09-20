import { describe, expect, it } from 'vitest';
import { computeTrade, type ExecutionInput } from './trade.js';

const at = (iso: string) => new Date(iso);

function exec(
  id: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  iso: string,
  fees = 0,
): ExecutionInput {
  return { id, side, quantity, price, executedAt: at(iso), fees };
}

describe('computeTrade', () => {
  it('computes a simple winning long on stock', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z', 1),
        exec('e2', 'SELL', 100, 12.5, '2026-03-02T18:00:00Z', 1),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL' },
    );

    expect(trade.direction).toBe('LONG');
    expect(trade.status).toBe('CLOSED');
    expect(trade.grossPnl.toString()).toBe('250');
    expect(trade.fees.toString()).toBe('2');
    expect(trade.netPnl.toString()).toBe('248');
    expect(trade.averageEntryPrice?.toString()).toBe('10');
    expect(trade.averageExitPrice?.toString()).toBe('12.5');
    expect(trade.openQuantity.toString()).toBe('0');
    expect(trade.durationMs).toBe(3.5 * 60 * 60 * 1000);
  });

  it('computes a winning short', () => {
    const trade = computeTrade(
      [
        exec('e1', 'SELL', 50, 200, '2026-03-02T14:30:00Z'),
        exec('e2', 'BUY', 50, 190, '2026-03-02T15:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'TSLA' },
    );

    expect(trade.direction).toBe('SHORT');
    expect(trade.netPnl.toString()).toBe('500');
  });

  it('applies the futures contract multiplier', () => {
    // MES moves $5 per index point per contract.
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 3, 5000, '2026-03-02T14:30:00Z', 1.5),
        exec('e2', 'SELL', 3, 5010, '2026-03-02T15:30:00Z', 1.5),
      ],
      { instrumentClass: 'FUTURES', symbol: 'MESZ5' },
    );

    expect(trade.multiplier.toString()).toBe('5');
    expect(trade.grossPnl.toString()).toBe('150');
    expect(trade.netPnl.toString()).toBe('147');
  });

  it('defaults equity options to 100 shares per contract', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 2, 1.5, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 2, 2.25, '2026-03-02T15:30:00Z'),
      ],
      { instrumentClass: 'OPTION', symbol: 'AAPL 260320C200' },
    );

    expect(trade.multiplier.toString()).toBe('100');
    expect(trade.grossPnl.toString()).toBe('150');
  });

  it('prefers an explicit multiplier over the symbol lookup', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 1, 100, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 1, 101, '2026-03-02T15:30:00Z'),
      ],
      { instrumentClass: 'FUTURES', symbol: 'ESZ5', multiplier: 7 },
    );

    expect(trade.multiplier.toString()).toBe('7');
    expect(trade.grossPnl.toString()).toBe('7');
  });

  it('matches scaled entries and exits FIFO', () => {
    // Buy 100 @ 10, buy 100 @ 12, sell 150 @ 14.
    // FIFO closes 100 from the 10 lot (+400) and 50 from the 12 lot (+100).
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z'),
        exec('e2', 'BUY', 100, 12, '2026-03-02T15:00:00Z'),
        exec('e3', 'SELL', 150, 14, '2026-03-02T16:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'NVDA' },
    );

    expect(trade.grossPnl.toString()).toBe('500');
    expect(trade.status).toBe('OPEN');
    expect(trade.openQuantity.toString()).toBe('50');
    expect(trade.peakQuantity.toString()).toBe('200');
    expect(trade.matches).toHaveLength(2);
    expect(trade.matches[0]?.quantity.toString()).toBe('100');
    expect(trade.matches[1]?.quantity.toString()).toBe('50');
    // Weighted average across both entries.
    expect(trade.averageEntryPrice?.toString()).toBe('11');
  });

  it('counts a reversal through flat and keeps the opening direction', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 2, 100, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 5, 110, '2026-03-02T15:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'SPY' },
    );

    expect(trade.direction).toBe('LONG');
    expect(trade.reversals).toBe(1);
    expect(trade.grossPnl.toString()).toBe('20');
    expect(trade.status).toBe('OPEN');
    expect(trade.openQuantity.toString()).toBe('3');
  });

  it('derives the R-multiple from the initial stop', () => {
    // Risk 1.00 per share over 100 shares, made 2.50 per share.
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 100, 12.5, '2026-03-02T18:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL', stopLoss: 9, takeProfit: 13 },
    );

    expect(trade.initialRisk?.toString()).toBe('100');
    expect(trade.rMultiple?.toString()).toBe('2.5');
    expect(trade.plannedRewardRisk?.toString()).toBe('3');
  });

  it('charges fees against the R-multiple', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z', 10),
        exec('e2', 'SELL', 100, 12, '2026-03-02T18:00:00Z', 10),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL', stopLoss: 9 },
    );

    expect(trade.grossPnl.toString()).toBe('200');
    expect(trade.netPnl.toString()).toBe('180');
    expect(trade.rMultiple?.toString()).toBe('1.8');
  });

  it('leaves the R-multiple null when no stop was recorded', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 100, 11, '2026-03-02T18:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL' },
    );

    expect(trade.rMultiple).toBeNull();
    expect(trade.initialRisk).toBeNull();
  });

  it('leaves the R-multiple null when the stop equals the entry', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z'),
        exec('e2', 'SELL', 100, 11, '2026-03-02T18:00:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL', stopLoss: 10 },
    );

    expect(trade.rMultiple).toBeNull();
  });

  it('holds precision on crypto quantities that a float would lose', () => {
    const trade = computeTrade(
      [
        exec('e1', 'BUY', 0.1, 60000.12, '2026-03-02T14:30:00Z'),
        exec('e2', 'BUY', 0.2, 60000.12, '2026-03-02T14:35:00Z'),
        exec('e3', 'SELL', 0.3, 60100.12, '2026-03-02T15:00:00Z'),
      ],
      { instrumentClass: 'CRYPTO', symbol: 'BTCUSD' },
    );

    // 0.1 + 0.2 must close the position exactly, and 100 * 0.3 is exactly 30.
    expect(trade.status).toBe('CLOSED');
    expect(trade.openQuantity.toString()).toBe('0');
    expect(trade.grossPnl.toString()).toBe('30');
  });

  it('sorts executions by time regardless of input order', () => {
    const trade = computeTrade(
      [
        exec('e2', 'SELL', 100, 12, '2026-03-02T18:00:00Z'),
        exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z'),
      ],
      { instrumentClass: 'STOCK', symbol: 'AAPL' },
    );

    expect(trade.direction).toBe('LONG');
    expect(trade.netPnl.toString()).toBe('200');
  });

  it('reports an open position with no realised P&L', () => {
    const trade = computeTrade([exec('e1', 'BUY', 100, 10, '2026-03-02T14:30:00Z', 1)], {
      instrumentClass: 'STOCK',
      symbol: 'AAPL',
    });

    expect(trade.status).toBe('OPEN');
    expect(trade.grossPnl.toString()).toBe('0');
    expect(trade.netPnl.toString()).toBe('-1');
    expect(trade.closedAt).toBeNull();
    expect(trade.durationMs).toBeNull();
  });

  it('rejects an empty execution list', () => {
    expect(() => computeTrade([], { instrumentClass: 'STOCK' })).toThrow(RangeError);
  });

  it('rejects a non-positive quantity', () => {
    expect(() =>
      computeTrade([exec('e1', 'BUY', 0, 10, '2026-03-02T14:30:00Z')], {
        instrumentClass: 'STOCK',
      }),
    ).toThrow(RangeError);
  });
});
