import { describe, expect, it } from 'vitest';
import { defaultPricePrecision, futuresRoot, resolveMultiplier } from './instruments.js';

describe('futuresRoot', () => {
  it('strips month and year codes', () => {
    expect(futuresRoot('ESZ5')).toBe('ES');
    expect(futuresRoot('MNQH6')).toBe('MNQ');
    expect(futuresRoot('ES 12-25')).toBe('ES');
    expect(futuresRoot('CL')).toBe('CL');
  });
});

describe('resolveMultiplier', () => {
  it('knows the common futures contracts', () => {
    expect(resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'ESZ5' }).toString()).toBe('50');
    expect(resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'MNQH6' }).toString()).toBe('2');
    expect(resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'MYMZ5' }).toString()).toBe(
      '0.5',
    );
  });

  it('falls back to 1 for an unknown futures symbol', () => {
    expect(resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'ZZZZ9' }).toString()).toBe('1');
  });

  it('uses 100 for options and 1 for cash instruments', () => {
    expect(resolveMultiplier({ instrumentClass: 'OPTION' }).toString()).toBe('100');
    expect(resolveMultiplier({ instrumentClass: 'STOCK' }).toString()).toBe('1');
    expect(resolveMultiplier({ instrumentClass: 'FOREX' }).toString()).toBe('1');
    expect(resolveMultiplier({ instrumentClass: 'CRYPTO' }).toString()).toBe('1');
  });

  it('ignores a zero or empty override', () => {
    expect(
      resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'ESZ5', override: 0 }).toString(),
    ).toBe('50');
    expect(
      resolveMultiplier({ instrumentClass: 'FUTURES', symbol: 'ESZ5', override: '' }).toString(),
    ).toBe('50');
  });
});

describe('defaultPricePrecision', () => {
  it('quotes each class at a sensible precision', () => {
    expect(defaultPricePrecision('FOREX')).toBe(5);
    expect(defaultPricePrecision('CRYPTO')).toBe(8);
    expect(defaultPricePrecision('STOCK')).toBe(2);
  });
});
