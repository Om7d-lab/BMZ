'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { SessionResponse } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Spinner } from '@/components/ui';

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest<SessionResponse>('/auth/register', {
        method: 'POST',
        body: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          displayName: String(form.get('displayName') ?? ''),
          // Taken from the browser so the trader's first calendar already draws
          // days on the boundary they actually trade to.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          locale: 'en',
          preferredCurrency: 'USD',
        },
      });

      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        setError(cause.message);
        setFieldErrors(cause.details ?? {});
      } else {
        setError('Could not reach the server. Try again.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="Name" error={fieldErrors.displayName?.[0]}>
        <Input
          name="displayName"
          autoComplete="name"
          required
          placeholder="How should we greet you?"
        />
      </Field>

      <Field label="Email" error={fieldErrors.email?.[0]}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Field
        label="Password"
        hint="At least 12 characters. Length beats punctuation."
        error={fieldErrors.password?.[0]}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
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
        {pending ? 'Creating your journal' : 'Create my journal'}
      </Button>
    </form>
  );
}
