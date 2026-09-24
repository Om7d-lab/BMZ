'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { AuthHeading } from '@/components/auth/AuthFrame';
import { Button, Field, Input, Spinner } from '@/components/ui';

/** Mirrors the server's policy in @bmz/contracts: length, nothing else. */
const MIN_LENGTH = 12;

/**
 * Completes a password reset.
 *
 * The token only ever travels in the request body — never rendered, never
 * stored. The server checks it (hashed, single-use, one hour), sets the new
 * password and revokes every session, so the next step is a fresh sign-in.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const submittable = password.length >= MIN_LENGTH && confirmation === password;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !submittable) return;

    setError(null);
    setPending(true);

    try {
      await apiRequest('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, password },
      });
      setDone(true);
      // Every session was just revoked, so send them to a clean sign-in.
      router.prefetch('/login');
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'Could not reach the server. Try again.',
      );
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div>
        <AuthHeading title="That link looks wrong">
          This page needs the link from your reset email. Ask for a new one and try again.
        </AuthHeading>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <span className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>

        <AuthHeading title="Password changed">
          Your password has been updated and every other session was signed out. Sign in with your
          new password to continue.
        </AuthHeading>

        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Choose a new password">
        At least {MIN_LENGTH} characters. Length beats punctuation.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="New password">
          <div className="relative">
            <Input
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              autoFocus
              minLength={MIN_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={tooShort || undefined}
              aria-describedby={tooShort ? 'password-hint' : undefined}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {tooShort ? (
            <p id="password-hint" className="mt-1.5 text-xs text-ink-subtle">
              {MIN_LENGTH - password.length} more to go.
            </p>
          ) : null}
        </Field>

        <Field label="Confirm new password">
          <Input
            name="confirmation"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'confirmation-hint' : undefined}
          />
          {mismatch ? (
            <p id="confirmation-hint" className="mt-1.5 text-xs text-loss">
              Those two don&apos;t match.
            </p>
          ) : null}
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-xs text-loss"
          >
            {error}{' '}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </p>
        ) : null}

        <Button type="submit" disabled={pending || !submittable} className="w-full">
          {pending ? <Spinner /> : null}
          {pending ? 'Saving' : 'Save new password'}
        </Button>
      </form>
    </div>
  );
}
