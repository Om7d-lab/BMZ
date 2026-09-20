import { describe, expect, it } from 'vitest';
import { buildEquityCurve, returnStandardDeviation } from './equity.js';

const at = (iso: string) => new Date(iso);

describe('buildEquityCurve', () => {
  it('accumulates equity from the starting balance', () => {
    const curve = buildEquityCurve(
      [
        { at: at('2026-03-02T20:00:00Z'), netPnl: 500 },
        { at: at('2026-03-03T20:00:00Z'), netPnl: -200 },
        { at: at('2026-03-04T20:00:00Z'), netPnl: 300 },
      ],
      10000,
    );

    expect(curve.points.map((point) => point.equity.toString())).toEqual([
      '10500',
      '10300',
      '10600',
    ]);
    expect(curve.endingEquity.toString()).toBe('10600');
    expect(curve.peakEquity.toString()).toBe('10600');
  });

  it('measures drawdown against the running high-water mark', () => {
    const curve = buildEquityCurve(
      [
        { at: at('2026-03-02T20:00:00Z'), netPnl: 1000 },
        { at: at('2026-03-03T20:00:00Z'), netPnl: -400 },
        { at: at('2026-03-04T20:00:00Z'), netPnl: -200 },
        { at: at('2026-03-05T20:00:00Z'), netPnl: 900 },
      ],
      10000,
    );

    // Peak 11000, trough 10400, so the deepest drawdown is 600.
    expect(curve.maxDrawdown.toString()).toBe('600');
    expect(curve.maxDrawdownPercent.toDecimalPlaces(6).toString()).toBe('0.054545');
    expect(curve.maxDrawdownAt).toEqual(at('2026-03-04T20:00:00Z'));
    // The later recovery to a new high leaves the final drawdown at zero.
    expect(curve.points.at(-1)?.drawdown.toString()).toBe('0');
  });

  it('sorts entries chronologically before accumulating', () => {
    const curve = buildEquityCurve(
      [
        { at: at('2026-03-04T20:00:00Z'), netPnl: 300 },
        { at: at('2026-03-02T20:00:00Z'), netPnl: 500 },
      ],
      0,
    );

    expect(curve.points[0]?.equity.toString()).toBe('500');
    expect(curve.points[1]?.equity.toString()).toBe('800');
  });

  it('returns a flat curve for no entries', () => {
    const curve = buildEquityCurve([], 2500);

    expect(curve.points).toHaveLength(0);
    expect(curve.endingEquity.toString()).toBe('2500');
    expect(curve.maxDrawdown.toString()).toBe('0');
    expect(curve.maxDrawdownAt).toBeNull();
  });
});

describe('returnStandardDeviation', () => {
  it('needs at least two periods', () => {
    expect(returnStandardDeviation([0.1])).toBeNull();
  });

  it('computes the sample standard deviation', () => {
    const result = returnStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result?.toDecimalPlaces(4).toString()).toBe('2.1381');
  });
});
