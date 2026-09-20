import { describe, expect, it } from 'vitest';
import {
  addDays,
  endOfTradingDay,
  groupByTradingDay,
  isValidTimeZone,
  startOfTradingDay,
  tradingDayKey,
  tradingDayRange,
} from './tradingDay.js';

describe('tradingDayKey', () => {
  it('uses the account timezone, not the server one', () => {
    // 04:00 UTC is still the previous evening in Chicago.
    const instant = new Date('2026-03-03T04:00:00Z');

    expect(tradingDayKey(instant, 'UTC')).toBe('2026-03-03');
    expect(tradingDayKey(instant, 'America/Chicago')).toBe('2026-03-02');
    expect(tradingDayKey(instant, 'Asia/Tehran')).toBe('2026-03-03');
    expect(tradingDayKey(instant, 'Asia/Tokyo')).toBe('2026-03-03');
  });

  it('places a late Tokyo evening on the next UTC day', () => {
    const instant = new Date('2026-03-02T16:00:00Z');
    expect(tradingDayKey(instant, 'Asia/Tokyo')).toBe('2026-03-03');
    expect(tradingDayKey(instant, 'UTC')).toBe('2026-03-02');
  });
});

describe('startOfTradingDay', () => {
  it('resolves midnight in the given timezone', () => {
    expect(startOfTradingDay('2026-03-03', 'UTC').toISOString()).toBe('2026-03-03T00:00:00.000Z');
    // Chicago is UTC-6 in early March, before the DST switch.
    expect(startOfTradingDay('2026-03-03', 'America/Chicago').toISOString()).toBe(
      '2026-03-03T06:00:00.000Z',
    );
    // Tehran runs UTC+3:30 year-round since 2022.
    expect(startOfTradingDay('2026-03-03', 'Asia/Tehran').toISOString()).toBe(
      '2026-03-02T20:30:00.000Z',
    );
  });

  it('survives a spring-forward day', () => {
    // US DST begins on 2026-03-08; the day still starts at local midnight.
    const start = startOfTradingDay('2026-03-08', 'America/New_York');
    expect(tradingDayKey(start, 'America/New_York')).toBe('2026-03-08');
    expect(tradingDayKey(new Date(start.getTime() - 1), 'America/New_York')).toBe('2026-03-07');
  });

  it('gives an exclusive end that belongs to the next day', () => {
    const end = endOfTradingDay('2026-03-03', 'America/Chicago');
    expect(tradingDayKey(end, 'America/Chicago')).toBe('2026-03-04');
    expect(tradingDayKey(new Date(end.getTime() - 1), 'America/Chicago')).toBe('2026-03-03');
  });

  it('rejects a malformed day key', () => {
    expect(() => startOfTradingDay('03/03/2026')).toThrow(RangeError);
  });
});

describe('addDays and tradingDayRange', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('enumerates an inclusive range', () => {
    expect(tradingDayRange('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('returns nothing for a reversed range', () => {
    expect(tradingDayRange('2026-03-04', '2026-03-01')).toEqual([]);
  });
});

describe('groupByTradingDay', () => {
  it('buckets by the account timezone', () => {
    const items = [
      { id: 'a', at: new Date('2026-03-03T04:00:00Z') },
      { id: 'b', at: new Date('2026-03-03T20:00:00Z') },
    ];

    const utc = groupByTradingDay(items, (item) => item.at, 'UTC');
    expect([...utc.keys()]).toEqual(['2026-03-03']);

    const chicago = groupByTradingDay(items, (item) => item.at, 'America/Chicago');
    expect([...chicago.keys()].sort()).toEqual(['2026-03-02', '2026-03-03']);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects nonsense', () => {
    expect(isValidTimeZone('Asia/Tehran')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
