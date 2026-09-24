import { describe, expect, it } from 'vitest';
import { decideGoogleSignIn, safeNextPath, type GoogleClaims } from './google-policy.js';

const claims = (overrides: Partial<GoogleClaims> = {}): GoogleClaims => ({
  sub: 'google-sub-1',
  email: 'trader@example.com',
  emailVerified: true,
  name: 'Trader',
  picture: null,
  ...overrides,
});

describe('decideGoogleSignIn', () => {
  it('signs in the user already linked to this Google account', () => {
    expect(
      decideGoogleSignIn({ claims: claims(), linkedUserId: 'u1', emailOwnerId: null }),
    ).toEqual({ kind: 'sign-in', userId: 'u1' });
  });

  it('honours an existing link even if the Google email later changed or lost verification', () => {
    // The link is keyed on `sub`; the email is not what authenticates here.
    expect(
      decideGoogleSignIn({
        claims: claims({ email: 'renamed@example.com', emailVerified: false }),
        linkedUserId: 'u1',
        emailOwnerId: 'someone-else',
      }),
    ).toEqual({ kind: 'sign-in', userId: 'u1' });
  });

  it('creates an account when nobody owns the verified address', () => {
    expect(
      decideGoogleSignIn({ claims: claims(), linkedUserId: null, emailOwnerId: null }),
    ).toEqual({ kind: 'create' });
  });

  it('never merges into an existing password account — it asks for the password first', () => {
    expect(
      decideGoogleSignIn({ claims: claims(), linkedUserId: null, emailOwnerId: 'u2' }),
    ).toEqual({ kind: 'link-required', userId: 'u2' });
  });

  it('rejects an unverified Google email rather than trusting it', () => {
    expect(
      decideGoogleSignIn({
        claims: claims({ emailVerified: false }),
        linkedUserId: null,
        emailOwnerId: null,
      }),
    ).toEqual({ kind: 'reject-unverified' });
  });

  it('does not reveal or link an existing account on an unverified email', () => {
    expect(
      decideGoogleSignIn({
        claims: claims({ emailVerified: false }),
        linkedUserId: null,
        emailOwnerId: 'u2',
      }),
    ).toEqual({ kind: 'reject-unverified' });
  });
});

describe('safeNextPath', () => {
  it('keeps on-site paths, query strings included', () => {
    expect(safeNextPath('/trades?account=a1')).toBe('/trades?account=a1');
  });

  it('falls back when missing', () => {
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
  });

  it('refuses anything that could leave the site', () => {
    for (const hostile of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'evil.example',
      'javascript:alert(1)',
    ]) {
      expect(safeNextPath(hostile)).toBe('/dashboard');
    }
  });
});
