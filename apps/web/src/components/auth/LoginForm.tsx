'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { SessionResponse } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Spinner } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

      // Come back to whatever they were trying to reach, but only if it is a
      // path on this site — an absolute URL here would be an open redirect.
      const next = searchParams.get('next');
      const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

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

      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
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
        {pending ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
