'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { SessionResponse } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { AuthHeading } from '@/components/auth/AuthFrame';
import {
  AuthDivider,
  GoogleSignInButton,
  googleErrorMessage,
} from '@/components/auth/GoogleSignInButton';

/**
 * The sign-in form, shown in the shared auth frame. Wired to the real
 * /auth/login endpoint, and honours the `next` redirect param.
 */
export function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Set by the Google callback, or by the app when a session has died.
  const next = searchParams.get('next');
  const googleError =
    googleErrorMessage(searchParams.get('error')) ??
    (searchParams.get('session') === 'expired'
      ? 'Your session has expired. Please sign in again.'
      : null);
  const linkingGoogle = searchParams.get('link') === 'google';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest<SessionResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        },
      });

      // Return to wherever they were headed, but only for on-site paths — an
      // absolute URL, or a `//` or `/\` one browsers read as another host,
      // would be an open redirect.
      const destination =
        next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
          ? next
          : '/dashboard';

      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'Could not reach the server. Try again.',
      );
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </AuthHeading>

      {linkingGoogle ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-ink"
        >
          <p className="font-medium">This email already has an account.</p>
          <p className="mt-0.5 text-ink-muted">
            Sign in with your password once to connect Google. After that, either works.
          </p>
        </div>
      ) : (
        <>
          {googleError ? (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-xs text-loss"
            >
              {googleError}
            </p>
          ) : null}

          <GoogleSignInButton next={next} disabled={pending} className="mt-8" />

          <div className="mt-6">
            <AuthDivider>or sign in with email</AuthDivider>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </Field>

        {/*
              Not a <Field>: the reset link belongs beside the label, and Field
              wraps its children in a <label>, where a nested link would both
              steal the label's click and read poorly to a screen reader.
            */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="text-xs font-medium text-ink-muted">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Your password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

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
          {pending ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </>
  );
}
