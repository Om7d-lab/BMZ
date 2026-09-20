import { describe, expect, it } from 'vitest';
import { formatRatio, formatSignedCurrency, pnlTone } from './format';

describe('pnlTone', () => {
  it('has exactly three states', () => {
    expect(pnlTone('120.5')).toBe('profit');
    expect(pnlTone('-3')).toBe('loss');
    expect(pnlTone('0')).toBe('flat');
  });

  it('treats missing and unparseable values as flat', () => {
    expect(pnlTone(null)).toBe('flat');
    expect(pnlTone(undefined)).toBe('flat');
    expect(pnlTone('')).toBe('flat');
    expect(pnlTone('not a number')).toBe('flat');
  });
});

describe('formatSignedCurrency', () => {
  it('always shows the sign', () => {
    expect(formatSignedCurrency('1240.5')).toBe('+$1,240.50');
    expect(formatSignedCurrency('-1240.5')).toBe('-$1,240.50');
  });

  it('renders an em dash for nothing', () => {
    expect(formatSignedCurrency(null)).toBe('—');
  });
});

describe('formatRatio', () => {
  it('fixes the precision and handles nulls', () => {
    expect(formatRatio('2.284618656')).toBe('2.28');
    expect(formatRatio(null)).toBe('—');
  });
});
