'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Spinner } from '@/components/ui';

/**
 * "Continue with Google". A real button rather than a link so it can show a
 * loading state and be disabled while another sign-in is in flight; pressing
 * it navigates the whole page to the API, which redirects on to Google.
 *
 * Nothing about the Google client lives here: the client secret, state, nonce
 * and PKCE verifier are all server-side, in an HttpOnly cookie.
 */
export function GoogleSignInButton({
  next,
  disabled = false,
  label = 'Continue with Google',
  className,
}: {
  /** Where to land after signing in. Validated again on the server. */
  next?: string | null;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const [redirecting, setRedirecting] = useState(false);

  // Coming back with the browser's Back button restores this page from the
  // back-forward cache with the spinner still going. Reset it.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function onClick() {
    setRedirecting(true);

    const params = new URLSearchParams();
    if (next) params.set('next', next);
    // Only used if this creates the account, so the trader's first calendar
    // draws its days on the boundary they actually trade to.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) params.set('tz', timezone);

    const query = params.toString();
    window.location.assign(`/api/v1/auth/google/start${query ? `?${query}` : ''}`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || redirecting}
      aria-busy={redirecting}
      className={clsx(
        'inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink',
        'transition-colors hover:border-line-strong hover:bg-surface-raised',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-surface',
        className,
      )}
    >
      {redirecting ? <Spinner /> : <GoogleLogo />}
      <span>{redirecting ? 'Redirecting to Google' : label}</span>
    </button>
  );
}

/** Google's four-colour "G", as its brand guidelines require it to appear. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** A thin rule with a word in it, between Google and the password form. */
export function AuthDivider({ children = 'or' }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-subtle">
      <span className="h-px flex-1 bg-line" aria-hidden />
      {children}
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );
}

/**
 * What the sign-in page says for each `?error=` the Google callback can send
 * back. Deliberately plain: the reason itself stays in the server log.
 */
export function googleErrorMessage(code: string | null): string | null {
  switch (code) {
    case 'google_cancelled':
      return 'Google sign-in was cancelled. You can try again, or sign in with your email.';
    case 'google_expired':
      return 'That Google sign-in took too long or was started in another browser. Please try again.';
    case 'google_unverified':
      return 'Google hasn’t verified the email on that account yet, so we can’t use it to sign you in.';
    case 'google_unavailable':
      return 'We couldn’t sign you in with that Google account. Contact support if this keeps happening.';
    case 'google_not_configured':
      return 'Google sign-in isn’t available right now. Please sign in with your email instead.';
    case 'google_failed':
      return 'We couldn’t complete Google sign-in. Check your connection and try again.';
    default:
      return null;
  }
}
