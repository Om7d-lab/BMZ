import { formatCurrency, formatDuration, formatNumber, formatPercent, formatR } from '@bmz/i18n';

export { formatCurrency, formatDuration, formatNumber, formatPercent, formatR };

/**
 * The colour a money figure should be shown in. Exactly three states, because
 * a fourth would mean the trader has to learn a legend.
 */
export function pnlTone(value: string | number | null | undefined): 'profit' | 'loss' | 'flat' {
  if (value === null || value === undefined || value === '') return 'flat';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return 'flat';
  return numeric > 0 ? 'profit' : 'loss';
}

export function pnlClass(value: string | number | null | undefined): string {
  switch (pnlTone(value)) {
    case 'profit':
      return 'text-profit';
    case 'loss':
      return 'text-loss';
    default:
      return 'text-ink-muted';
  }
}

/** A signed money figure, which is how P&L should always read. */
export function formatSignedCurrency(
  value: string | number | null | undefined,
  currency = 'USD',
): string {
  if (value === null || value === undefined || value === '') return '—';
  return formatCurrency(value, currency, 'en', { signDisplay: 'always' });
}

export function formatMaybeCurrency(value: string | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || value === '') return '—';
  return formatCurrency(value, currency, 'en');
}

export function formatRatio(value: string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toFixed(digits);
}

/** A price, at the precision the instrument is quoted in. */
export function formatPrice(value: string | null | undefined, instrumentClass: string): string {
  if (value === null || value === undefined || value === '') return '—';

  const digits =
    instrumentClass === 'FOREX'
      ? 5
      : instrumentClass === 'CRYPTO'
        ? 2
        : instrumentClass === 'FUTURES'
          ? 2
          : 2;

  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
