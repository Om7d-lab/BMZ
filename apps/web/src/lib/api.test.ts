import { describe, expect, it } from 'vitest';
import { ApiRequestError, queryString } from './api';

describe('queryString', () => {
  it('drops empty values', () => {
    expect(queryString({ a: 1, b: undefined, c: null, d: '' })).toBe('?a=1');
  });

  it('repeats a key for each array item', () => {
    expect(queryString({ tagIds: ['a', 'b'] })).toBe('?tagIds=a&tagIds=b');
  });

  it('returns an empty string when there is nothing to send', () => {
    expect(queryString({})).toBe('');
    expect(queryString({ a: undefined })).toBe('');
  });

  it('keeps a value that contains a comma intact', () => {
    expect(queryString({ symbols: ['A,B'] })).toBe('?symbols=A%2CB');
  });
});

describe('ApiRequestError', () => {
  it('exposes field errors for a form', () => {
    const error = new ApiRequestError(400, 'Validation failed', {
      'executions.0.price': ['Expected a decimal number'],
    });

    expect(error.fieldErrors('executions.0.price')).toEqual(['Expected a decimal number']);
    expect(error.fieldErrors('symbol')).toEqual([]);
    expect(error.isUnauthorized).toBe(false);
  });

  it('flags an expired session', () => {
    expect(new ApiRequestError(401, 'Not signed in').isUnauthorized).toBe(true);
  });
});
