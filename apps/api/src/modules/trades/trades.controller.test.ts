import { describe, expect, it } from 'vitest';
import { normalizeArrayParams } from './trades.controller.js';

describe('normalizeArrayParams', () => {
  it('lifts a single repeatable value into an array', () => {
    expect(normalizeArrayParams({ tagIds: 'abc' }).tagIds).toEqual(['abc']);
  });

  it('splits a comma-separated list', () => {
    expect(normalizeArrayParams({ symbols: 'AAPL, MSFT' }).symbols).toEqual(['AAPL', 'MSFT']);
  });

  it('leaves an existing array alone', () => {
    expect(normalizeArrayParams({ tagIds: ['a', 'b'] }).tagIds).toEqual(['a', 'b']);
  });

  it('does not touch keys that are not repeatable', () => {
    expect(normalizeArrayParams({ search: 'a,b' }).search).toBe('a,b');
  });
});
