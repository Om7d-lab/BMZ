import { describe, expect, it } from 'vitest';
import { durationBucket } from './analytics.service.js';

describe('durationBucket', () => {
  it('names each holding-period band', () => {
    expect(durationBucket(30_000)).toBe('Under a minute');
    expect(durationBucket(180_000)).toBe('1-5 minutes');
    expect(durationBucket(900_000)).toBe('5-30 minutes');
    expect(durationBucket(3_600_000)).toBe('30 minutes - 2 hours');
    expect(durationBucket(43_200_000)).toBe('2 hours - 1 day');
    expect(durationBucket(3 * 86_400_000)).toBe('1-7 days');
    expect(durationBucket(30 * 86_400_000)).toBe('Over a week');
  });

  it('separates trades that are still running', () => {
    expect(durationBucket(null)).toBe('Still open');
  });
});
