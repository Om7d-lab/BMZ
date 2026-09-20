import { localeTag } from './messages.js';
import { DEFAULT_LOCALE, type Locale } from './locales.js';

/**
 * Formatting helpers that take the decimal *strings* the API sends.
 *
 * Converting to a Number here is deliberate and safe: these values are only
 * ever on their way to a screen, and Intl needs a number. All arithmetic
 * happens in @bmz/core on Decimals, never on the output of these functions.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  value: string | number,
  currency = 'USD',
  locale: Locale = DEFAULT_LOCALE,
  options: { signDisplay?: 'auto' | 'always' | 'never'; compact?: boolean } = {},
): string {
  const key = `${locale}|${currency}|${options.signDisplay ?? 'auto'}|${options.compact ? 'c' : 'f'}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency,
      signDisplay: options.signDisplay ?? 'auto',
      notation: options.compact ? 'compact' : 'standard',
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(Number(value));
}

export function formatPercent(
  value: string | number | null,
  locale: Locale = DEFAULT_LOCALE,
  fractionDigits = 1,
): string {
  if (value === null) return '—';
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value));
}

export function formatNumber(
  value: string | number | null,
  locale: Locale = DEFAULT_LOCALE,
  fractionDigits = 2,
): string {
  if (value === null) return '—';
  return new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value));
}

/** An R-multiple, always signed, because "+2.4R" and "2.4R" read differently. */
export function formatR(value: string | number | null, locale: Locale = DEFAULT_LOCALE): string {
  if (value === null) return '—';
  const formatted = new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(Number(value));
  return `${formatted}R`;
}

/** A holding period in the largest sensible unit: "4m", "2h 15m", "3d". */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatDateTime(
  value: string | Date,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDate(
  value: string | Date,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(localeTag(locale), { timeZone, dateStyle: 'medium' }).format(
    typeof value === 'string' ? new Date(value) : value,
  );
}
