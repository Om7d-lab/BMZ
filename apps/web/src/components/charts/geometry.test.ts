import { describe, expect, it } from 'vitest';
import { areaPath, downsample, linearScale, linePath, niceTicks } from './geometry';

describe('linearScale', () => {
  it('maps the ends of the domain onto the ends of the range', () => {
    const scale = linearScale(0, 100, 0, 500);
    expect(scale.to(0)).toBe(0);
    expect(scale.to(100)).toBe(500);
    expect(scale.to(50)).toBe(250);
  });

  it('does not divide by zero on a flat series', () => {
    const scale = linearScale(10, 10, 0, 100);
    expect(Number.isFinite(scale.to(10))).toBe(true);
  });
});

describe('niceTicks', () => {
  it('rounds out to readable bounds', () => {
    const result = niceTicks(2, 97, 4);
    expect(result.min).toBeLessThanOrEqual(2);
    expect(result.max).toBeGreaterThanOrEqual(97);
    expect(result.ticks.length).toBeGreaterThan(2);
  });

  it('handles a degenerate range without producing NaN', () => {
    const result = niceTicks(5, 5);
    expect(result.ticks.every(Number.isFinite)).toBe(true);
    expect(result.min).toBeLessThan(result.max);
  });

  it('survives non-finite input', () => {
    const result = niceTicks(Number.NaN, Number.NaN);
    expect(result.ticks.every(Number.isFinite)).toBe(true);
  });

  it('spans negative to positive', () => {
    const result = niceTicks(-1200, 3400, 4);
    expect(result.min).toBeLessThanOrEqual(-1200);
    expect(result.max).toBeGreaterThanOrEqual(3400);
  });
});

describe('linePath and areaPath', () => {
  it('produces a move followed by line segments', () => {
    expect(
      linePath([
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ]),
    ).toBe('M0.00,1.00 L2.00,3.00');
  });

  it('closes the area down to the baseline', () => {
    const path = areaPath(
      [
        { x: 0, y: 10 },
        { x: 5, y: 2 },
      ],
      20,
    );
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('L5.00,20.00');
    expect(path).toContain('L0.00,20.00');
  });

  it('returns nothing for no points', () => {
    expect(linePath([])).toBe('');
    expect(areaPath([], 10)).toBe('');
  });
});

describe('downsample', () => {
  it('leaves a short series alone', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('keeps the first and last points', () => {
    const series = Array.from({ length: 1000 }, (_, index) => index);
    const sampled = downsample(series, 50);

    expect(sampled).toHaveLength(50);
    expect(sampled[0]).toBe(0);
    expect(sampled.at(-1)).toBe(999);
  });
});
