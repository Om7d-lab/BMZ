import { describe, expect, it } from 'vitest';
import {
  createTradeRequest,
  currencyCode,
  decimalString,
  listTradesQuery,
  loginRequest,
  nonNegativeDecimalString,
  paginationQuery,
  positiveDecimalString,
  registerRequest,
  timezone,
} from './index.js';

/**
 * These schemas are the only thing standing between a malformed request and the
 * domain engine, so the cases worth testing are the ones where a value is
 * plausible but wrong: a float that lost precision, a timezone that does not
 * exist, a double-submitted fill.
 */

const fill = (over: Record<string, unknown> = {}) => ({
  side: 'BUY',
  quantity: '1',
  price: '100',
  executedAt: '2026-09-18T13:30:00.000Z',
  ...over,
});

describe('decimalString', () => {
  it('accepts the precision a float would lose', () => {
    expect(decimalString.parse('0.00000001')).toBe('0.00000001');
    expect(decimalString.parse('-12345678901234.123456')).toBe('-12345678901234.123456');
  });

  it('rejects the shapes that arrive when someone sends a number', () => {
    for (const bad of ['1e3', 'NaN', 'Infinity', '1,234.56', '1.', '.5', '', '12.3.4']) {
      expect(decimalString.safeParse(bad).success).toBe(false);
    }
  });

  it('separates positive from non-negative', () => {
    expect(positiveDecimalString.safeParse('0').success).toBe(false);
    expect(nonNegativeDecimalString.safeParse('0').success).toBe(true);
    expect(nonNegativeDecimalString.safeParse('-0.000001').success).toBe(false);
  });
});

describe('timezone', () => {
  it('accepts IANA zones and rejects abbreviations', () => {
    expect(timezone.safeParse('America/Chicago').success).toBe(true);
    expect(timezone.safeParse('Asia/Tehran').success).toBe(true);
    expect(timezone.safeParse('EST5EDT').success).toBe(true); // a real zone, if an old one
    expect(timezone.safeParse('Pacific/Nowhere').success).toBe(false);
    expect(timezone.safeParse('GMT+3').success).toBe(false);
  });
});

describe('currencyCode', () => {
  it('normalises case rather than refusing it', () => {
    expect(currencyCode.parse(' usd ')).toBe('USD');
    expect(currencyCode.safeParse('US').success).toBe(false);
    expect(currencyCode.safeParse('DOLLAR').success).toBe(false);
  });
});

describe('createTradeRequest', () => {
  const base = {
    accountId: 'acc_1',
    symbol: 'mesz5',
    instrumentClass: 'FUTURES',
    executions: [fill(), fill({ side: 'SELL', executedAt: '2026-09-18T14:00:00.000Z' })],
  };

  it('upper-cases the symbol and defaults fees and tags', () => {
    const parsed = createTradeRequest.parse(base);
    expect(parsed.symbol).toBe('MESZ5');
    expect(parsed.tagIds).toEqual([]);
    expect(parsed.executions[0]?.fees).toBe('0');
  });

  it('refuses a trade with no fills', () => {
    const result = createTradeRequest.safeParse({ ...base, executions: [] });
    expect(result.success).toBe(false);
  });

  it('catches a double-submitted fill and points at the right field', () => {
    const result = createTradeRequest.safeParse({ ...base, executions: [fill(), fill()] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['executions']);
  });

  it('allows two fills that differ only by timestamp', () => {
    const result = createTradeRequest.safeParse({
      ...base,
      executions: [fill(), fill({ executedAt: '2026-09-18T13:30:01.000Z' })],
    });
    expect(result.success).toBe(true);
  });

  it('refuses a zero or negative quantity', () => {
    for (const quantity of ['0', '-1']) {
      expect(
        createTradeRequest.safeParse({ ...base, executions: [fill({ quantity })] }).success,
      ).toBe(false);
    }
  });
});

describe('pagination and list query', () => {
  it('coerces the limit a query string delivers as text', () => {
    expect(paginationQuery.parse({ limit: '25' }).limit).toBe(25);
    expect(paginationQuery.parse({}).limit).toBe(50);
    expect(paginationQuery.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('defaults the sort so two pages of the same filter agree', () => {
    const parsed = listTradesQuery.parse({});
    expect(parsed.sortBy).toBe('openedAt');
    expect(parsed.sortDir).toBe('desc');
  });

  it('takes dates as calendar days, not instants', () => {
    expect(listTradesQuery.safeParse({ from: '2026-09-01' }).success).toBe(true);
    expect(listTradesQuery.safeParse({ from: '2026-09-01T00:00:00Z' }).success).toBe(false);
  });
});

describe('auth', () => {
  it('asks for length and nothing else', () => {
    expect(
      registerRequest.safeParse({
        email: 'Trader@Example.COM ',
        password: 'correct horse battery',
        displayName: 'Trader',
      }).success,
    ).toBe(true);

    expect(
      registerRequest.safeParse({
        email: 'trader@example.com',
        password: 'Sh0rt!A',
        displayName: 'Trader',
      }).success,
    ).toBe(false);
  });

  it('normalises the email so sign-in matches sign-up', () => {
    const parsed = registerRequest.parse({
      email: ' Trader@Example.COM ',
      password: 'correct horse battery',
      displayName: 'Trader',
    });
    expect(parsed.email).toBe('trader@example.com');
    expect(parsed.timezone).toBe('UTC');
    expect(parsed.preferredCurrency).toBe('USD');
  });

  it('does not apply the length policy to sign-in, where the old password may be shorter', () => {
    expect(loginRequest.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });
});
