import { z } from 'zod';
import { currencyCode, cuid, isoDateTime, membershipRole, timezone } from './common.js';

/**
 * Password policy: length carries far more entropy than composition rules, and
 * composition rules push people towards predictable substitutions. We ask for
 * 12 characters and check nothing else.
 */
export const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'That is longer than we can hash');

/**
 * Trim and lower-case *before* validating, not after.
 *
 * `z.email().trim()` reads left to right: the address is checked first and the
 * whitespace stripped afterwards, so a pasted " trader@example.com " is
 * rejected outright. Normalising first also means the address stored at
 * registration is byte-identical to the one sent at sign-in, which is what the
 * unique index on `users.email` relies on.
 */
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(320));

export const registerRequest = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(80),
  /// Defaults come from the browser at sign-up so the first calendar is right.
  timezone: timezone.default('UTC'),
  locale: z.string().min(2).max(10).default('en'),
  preferredCurrency: currencyCode.default('USD'),
  /** Optional workspace name; defaults to the person's own name. */
  organizationName: z.string().trim().min(1).max(80).optional(),
});
export type RegisterRequest = z.infer<typeof registerRequest>;

export const loginRequest = z.object({
  email,
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof loginRequest>;

export const requestPasswordResetRequest = z.object({ email });
export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetRequest>;

export const resetPasswordRequest = z.object({
  token: z.string().min(16).max(200),
  password,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequest>;

export const verifyEmailRequest = z.object({
  token: z.string().min(16).max(200),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequest>;

export const changePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;

export const organizationSummary = z.object({
  id: cuid,
  name: z.string(),
  slug: z.string(),
  role: membershipRole,
  plan: z.string(),
});
export type OrganizationSummary = z.infer<typeof organizationSummary>;

export const userProfile = z.object({
  id: cuid,
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  timezone: z.string(),
  preferredCurrency: z.string(),
  emailVerified: z.boolean(),
  isPlatformAdmin: z.boolean(),
  createdAt: isoDateTime,
});
export type UserProfile = z.infer<typeof userProfile>;

/**
 * Tokens are delivered as httpOnly cookies, not in this body — a token in a
 * JSON response ends up in localStorage, where any script on the page can read
 * it. The body carries only what the UI needs to render.
 */
export const sessionResponse = z.object({
  user: userProfile,
  organizations: z.array(organizationSummary),
  activeOrganizationId: cuid.nullable(),
  /** When the short-lived access cookie expires, so the client can pre-refresh. */
  accessTokenExpiresAt: isoDateTime,
});
export type SessionResponse = z.infer<typeof sessionResponse>;

export const updateProfileRequest = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: timezone.optional(),
  preferredCurrency: currencyCode.optional(),
  avatarUrl: z.url().max(2048).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequest>;
