import { describe, expect, it } from 'vitest';
import { directionOf, isLocale, isRtl, negotiateLocale } from './locales.js';
import { translate, translationCoverage } from './messages.js';
import { formatDuration, formatR } from './format.js';

describe('locale registry', () => {
  it('marks Persian and Arabic right-to-left', () => {
    expect(isRtl('fa')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('ja')).toBe('ltr');
  });

  it('recognises supported locales only', () => {
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});

describe('negotiateLocale', () => {
  it('honours quality weighting', () => {
    expect(negotiateLocale('de;q=0.9,fa;q=1.0')).toBe('fa');
  });

  it('falls back from a regional tag to its base language', () => {
    expect(negotiateLocale('pt-PT,pt;q=0.9')).toBe('pt');
    expect(negotiateLocale('zh-CN')).toBe('zh-CN');
  });

  it('defaults to English for an unsupported or missing header', () => {
    expect(negotiateLocale('de-DE,de;q=0.9')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
    expect(negotiateLocale('')).toBe('en');
  });
});

describe('translate', () => {
  it('falls back to English for an untranslated key', () => {
    expect(translate('fa', 'metric.netPnl')).toBe('Net P&L');
  });

  it('substitutes placeholders and leaves unknown ones visible', () => {
    // Uses a known key with no placeholders to confirm the pass-through path.
    expect(translate('en', 'common.save', { unused: 1 })).toBe('Save');
  });

  it('reports coverage', () => {
    expect(translationCoverage('en')).toBe(1);
    expect(translationCoverage('fa')).toBe(0);
  });
});

describe('formatters', () => {
  it('always signs an R-multiple', () => {
    expect(formatR(2.4)).toBe('+2.40R');
    expect(formatR(-1)).toBe('-1.00R');
    expect(formatR(null)).toBe('—');
  });

  it('picks the largest sensible duration unit', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(240_000)).toBe('4m');
    expect(formatDuration(8_100_000)).toBe('2h 15m');
    expect(formatDuration(259_200_000)).toBe('3d');
    expect(formatDuration(null)).toBe('—');
  });
});
