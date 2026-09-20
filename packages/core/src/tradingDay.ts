/**
 * Trading-day helpers.
 *
 * A journal lives or dies on getting the day boundary right: a trader in
 * Tehran and a trader in Chicago closing the same position at the same instant
 * are on different calendar days, and every calendar, streak and daily summary
 * has to agree with the one the trader sees on their own clock. Everything
 * here derives the day from an IANA timezone rather than the server's locale.
 */

/** A trading day as `YYYY-MM-DD` in the account's timezone. */
export type TradingDayKey = string;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    // en-CA formats as YYYY-MM-DD, which sorts lexicographically.
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function tradingDayKey(instant: Date, timeZone = 'UTC'): TradingDayKey {
  return dayFormatter(timeZone).format(instant);
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    // Intl renders midnight as hour 24 in some environments.
    return Number(value) % (type === 'hour' ? 24 : Number.MAX_SAFE_INTEGER);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes. */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // Drop milliseconds on both sides so the difference is whole minutes.
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant at which the given trading day starts in `timeZone`. */
export function startOfTradingDay(day: TradingDayKey, timeZone = 'UTC'): Date {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) {
    throw new RangeError(`Expected a YYYY-MM-DD trading day, received "${day}"`);
  }

  // Guess with the offset at noon UTC (away from any DST transition), then
  // correct once using the offset actually in force at the candidate instant.
  const guess = new Date(Date.UTC(year, month - 1, date, 12, 0, 0));
  const offset = timeZoneOffsetMinutes(guess, timeZone);
  const candidate = new Date(Date.UTC(year, month - 1, date, 0, 0, 0) - offset * 60000);
  const correctedOffset = timeZoneOffsetMinutes(candidate, timeZone);
  if (correctedOffset === offset) return candidate;
  return new Date(Date.UTC(year, month - 1, date, 0, 0, 0) - correctedOffset * 60000);
}

/** The UTC instant immediately after the given trading day ends, exclusive. */
export function endOfTradingDay(day: TradingDayKey, timeZone = 'UTC'): Date {
  return startOfTradingDay(addDays(day, 1), timeZone);
}

/** Shifts a trading-day key by whole calendar days. */
export function addDays(day: TradingDayKey, amount: number): TradingDayKey {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) {
    throw new RangeError(`Expected a YYYY-MM-DD trading day, received "${day}"`);
  }
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return shifted.toISOString().slice(0, 10);
}

/** Every trading-day key from `from` to `to`, inclusive. */
export function tradingDayRange(from: TradingDayKey, to: TradingDayKey): TradingDayKey[] {
  const days: TradingDayKey[] = [];
  let cursor = from;
  // Bounded so a reversed range cannot spin forever.
  for (let i = 0; cursor <= to && i < 4000; i += 1) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Groups items by the trading day of their timestamp in `timeZone`. */
export function groupByTradingDay<T>(
  items: readonly T[],
  getInstant: (item: T) => Date,
  timeZone = 'UTC',
): Map<TradingDayKey, T[]> {
  const grouped = new Map<TradingDayKey, T[]>();
  for (const item of items) {
    const key = tradingDayKey(getInstant(item), timeZone);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }
  return grouped;
}
