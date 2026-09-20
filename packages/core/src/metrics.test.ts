import { describe, expect, it } from 'vitest';
import { classifyOutcome, computeStreaks, summarizePerformance } from './metrics.js';

const at = (iso: string) => new Date(iso);

describe('classifyOutcome', () => {
  it('splits wins, losses and break-even', () => {
    expect(classifyOutcome(10)).toBe('WIN');
    expect(classifyOutcome(-10)).toBe('LOSS');
    expect(classifyOutcome(0)).toBe('BREAKEVEN');
  });
});

describe('summarizePerformance', () => {
  const trades = [
    { id: 't1', netPnl: 300, closedAt: at('2026-03-02T20:00:00Z'), rMultiple: 3, durationMs: 1000 },
    {
      id: 't2',
      netPnl: -100,
      closedAt: at('2026-03-03T20:00:00Z'),
      rMultiple: -1,
      durationMs: 3000,
    },
    { id: 't3', netPnl: 200, closedAt: at('2026-03-04T20:00:00Z'), rMultiple: 2, durationMs: 2000 },
    {
      id: 't4',
      netPnl: -100,
      closedAt: at('2026-03-05T20:00:00Z'),
      rMultiple: -1,
      durationMs: 2000,
    },
  ];

  it('computes the headline statistics', () => {
    const summary = summarizePerformance(trades);

    expect(summary.tradeCount).toBe(4);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(2);
    expect(summary.winRate?.toString()).toBe('0.5');
    expect(summary.grossProfit.toString()).toBe('500');
    expect(summary.grossLoss.toString()).toBe('200');
    expect(summary.netPnl.toString()).toBe('300');
    expect(summary.profitFactor.toString()).toBe('2.5');
    expect(summary.averageWin.toString()).toBe('250');
    expect(summary.averageLoss.toString()).toBe('100');
    expect(summary.payoffRatio.toString()).toBe('2.5');
    // 0.5 * 250 - 0.5 * 100 = 75 per trade.
    expect(summary.expectancy.toString()).toBe('75');
    expect(summary.largestWin.toString()).toBe('300');
    expect(summary.largestLoss.toString()).toBe('-100');
    expect(summary.averageRMultiple.toString()).toBe('0.75');
    expect(summary.totalR.toString()).toBe('3');
    expect(summary.averageDurationMs).toBe(2000);
  });

  it('excludes open trades', () => {
    const summary = summarizePerformance([...trades, { id: 't5', netPnl: 9999, closedAt: null }]);

    expect(summary.tradeCount).toBe(4);
    expect(summary.netPnl.toString()).toBe('300');
  });

  it('keeps break-even trades out of the win-rate base', () => {
    const summary = summarizePerformance([
      { id: 'a', netPnl: 100, closedAt: at('2026-03-02T20:00:00Z') },
      { id: 'b', netPnl: 0, closedAt: at('2026-03-03T20:00:00Z') },
      { id: 'c', netPnl: -50, closedAt: at('2026-03-04T20:00:00Z') },
    ]);

    expect(summary.breakEven).toBe(1);
    expect(summary.winRate.toString()).toBe('0.5');
  });

  it('returns null ratios rather than Infinity when there are no losses', () => {
    const summary = summarizePerformance([
      { id: 'a', netPnl: 100, closedAt: at('2026-03-02T20:00:00Z') },
    ]);

    expect(summary.profitFactor).toBeNull();
    expect(summary.averageLoss).toBeNull();
    expect(summary.payoffRatio).toBeNull();
    expect(summary.winRate.toString()).toBe('1');
  });

  it('handles an empty set without dividing by zero', () => {
    const summary = summarizePerformance([]);

    expect(summary.tradeCount).toBe(0);
    expect(summary.netPnl.toString()).toBe('0');
    expect(summary.winRate).toBeNull();
    expect(summary.profitFactor).toBeNull();
    expect(summary.expectancy).toBeNull();
    expect(summary.currentStreak).toBeNull();
  });
});

describe('computeStreaks', () => {
  it('finds the longest runs and the current one', () => {
    const result = computeStreaks(['WIN', 'WIN', 'WIN', 'LOSS', 'WIN', 'LOSS', 'LOSS']);

    expect(result.longestWinStreak).toBe(3);
    expect(result.longestLossStreak).toBe(2);
    expect(result.currentStreak).toEqual({ outcome: 'LOSS', length: 2 });
  });

  it('lets a break-even trade neither extend nor break a run', () => {
    const result = computeStreaks(['WIN', 'BREAKEVEN', 'WIN']);

    expect(result.longestWinStreak).toBe(2);
    expect(result.currentStreak).toEqual({ outcome: 'WIN', length: 2 });
  });
});
