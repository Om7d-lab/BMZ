import { describe, expect, it } from 'vitest';
import { parseDuration } from './token.service.js';

describe('parseDuration', () => {
  it('parses each supported unit', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('45s')).toBe(45_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('12h')).toBe(43_200_000);
    expect(parseDuration('30d')).toBe(2_592_000_000);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDuration(' 15m ')).toBe(900_000);
  });

  it('rejects anything it cannot parse rather than defaulting', () => {
    expect(() => parseDuration('forever')).toThrow(RangeError);
    expect(() => parseDuration('15')).toThrow(RangeError);
    expect(() => parseDuration('15w')).toThrow(RangeError);
  });
});
