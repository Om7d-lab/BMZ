import { describe, expect, it } from 'vitest';
import { currencyDecimals, dec, roundMoney, safeDivide, sum, toFixedString } from './money.js';

describe('dec', () => {
  it('coerces strings, numbers and nullish values', () => {
    expect(dec('1.25').toString()).toBe('1.25');
    expect(dec(3).toString()).toBe('3');
    expect(dec(null).toString()).toBe('0');
    expect(dec(undefined).toString()).toBe('0');
  });

  it('rejects a non-finite input', () => {
    expect(() => dec(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => dec(Number.NaN)).toThrow(RangeError);
  });
});

describe('sum', () => {
  it('adds without binary drift', () => {
    expect(sum([0.1, 0.2]).toString()).toBe('0.3');
    expect(sum([]).toString()).toBe('0');
  });
});

describe('safeDivide', () => {
  it('returns null instead of dividing by zero', () => {
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(10, 4).toString()).toBe('2.5');
  });
});

describe('roundMoney', () => {
  it('respects each currency minor unit', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('jpy')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(roundMoney('10.005', 'USD').toString()).toBe('10');
    expect(roundMoney('10.015', 'USD').toString()).toBe('10.02');
    expect(roundMoney('1234.6', 'JPY').toString()).toBe('1235');
  });
});

describe('toFixedString', () => {
  it('pads to the requested precision', () => {
    expect(toFixedString('1.5', 4)).toBe('1.5000');
  });
});
