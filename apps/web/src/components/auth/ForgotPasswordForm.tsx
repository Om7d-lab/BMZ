'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Spinner } from '@/components/ui';

/**
 * Starts a password reset.
 *
 * The API answers 202 whether or not the address is registered, and this screen
 * keeps that promise: the same confirmation is shown either way, so the form
 * cannot be used to discover which addresses have accounts.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest('/auth/password-reset/request', {
        method: 'POST',
        body: { email: String(form.get('email') ?? '') },
      });
      setSent(true);
    } catch (cause) {
      // A rejected address is the one thing that can fail here, and only
      // because it isn't an email at all.
      setError(
        cause instanceof ApiRequestError ? cause.message : 'Could not reach the server. Try again.',
      );
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6">
        <span className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
          <MailCheck className="size-5" aria-hidden />
        </span>

        <h1 className="text-lg font-semibold tracking-tight text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          If an account exists for that address, we&apos;ve sent a link to reset your password. It
          expires in an hour and can only be used once.
        </p>

        <p className="mt-6 text-center text-xs text-ink-subtle">
          <Link href="/login" className="text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the address you signed up with and we&apos;ll send you a link.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@example.com"
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-xs text-loss"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner /> : null}
          {pending ? 'Sending' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        Remembered it?{' '}
        <Link href="/login" className="text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
