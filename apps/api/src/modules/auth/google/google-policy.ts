/**
 * What to do with a verified Google sign-in.
 *
 * Kept free of I/O so the account-linking rules — the security-sensitive part —
 * can be tested exhaustively on their own.
 */

export interface GoogleClaims {
  /** Google's stable, never-reassigned account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export type GoogleSignInDecision =
  /** This Google account is already linked: sign its user in. */
  | { kind: 'sign-in'; userId: string }
  /** Nobody has this address: create an account for it. */
  | { kind: 'create' }
  /**
   * A password account already owns this address. Never merge here: the
   * visitor has proved they control the inbox, not that they know the
   * password, and the password may have been set by someone else before the
   * owner ever arrived. They sign in with the password once, and the Google
   * identity is attached then.
   */
  | { kind: 'link-required'; userId: string }
  /** Google has not confirmed the address, so it proves nothing. */
  | { kind: 'reject-unverified' };

export function decideGoogleSignIn(input: {
  claims: GoogleClaims;
  /** User already linked to this Google `sub`, if any. */
  linkedUserId: string | null;
  /** Live (not deleted) user who owns this email, if any. */
  emailOwnerId: string | null;
}): GoogleSignInDecision {
  // An existing link is keyed on `sub`, which Google never reassigns, so it
  // stands even if the Google account's email has since changed.
  if (input.linkedUserId) return { kind: 'sign-in', userId: input.linkedUserId };

  // Everything below trusts the email, so it must be one Google vouches for.
  if (!input.claims.emailVerified) return { kind: 'reject-unverified' };

  if (input.emailOwnerId) return { kind: 'link-required', userId: input.emailOwnerId };

  return { kind: 'create' };
}

/**
 * Where to send someone after signing in: an on-site path only.
 *
 * Rejects protocol-relative (`//evil.example`) and backslash (`/\evil.example`)
 * forms, which some browsers resolve to another origin.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
