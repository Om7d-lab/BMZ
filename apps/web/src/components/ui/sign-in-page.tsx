'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { SessionResponse } from '@bmz/contracts';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { Wordmark } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * A full-screen split sign-in: a brand showcase on the left (large screens) and
 * the sign-in form on the right. The form is wired to the real /auth/login
 * endpoint and honours the `next` redirect param, so it is a working sign-in,
 * not a mockup.
 */
export function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The showcase video is decoration. Anyone who asks for less motion gets a
  // still frame instead, and the preference is honoured if it changes live.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dropGestureListeners = () => {};

    const apply = () => {
      if (query.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Muted autoplay is still refused in places — Safari in Low Power Mode,
        // or a per-site autoplay block. Start on the first interaction instead
        // rather than leaving a frozen frame behind the copy.
        const start = () => {
          dropGestureListeners();
          void video.play().catch(() => {});
        };

        window.addEventListener('pointerdown', start, { once: true });
        window.addEventListener('keydown', start, { once: true });

        dropGestureListeners = () => {
          window.removeEventListener('pointerdown', start);
          window.removeEventListener('keydown', start);
        };
      });
    };

    apply();
    query.addEventListener('change', apply);

    return () => {
      query.removeEventListener('change', apply);
      dropGestureListeners();
    };
  }, []);

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
      // absolute URL here would be an open redirect.
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
    <main className="flex min-h-dvh">
      {/* Left: brand showcase (large screens only) */}
      <aside className="dark-scope relative hidden flex-1 overflow-hidden border-e border-line bg-canvas lg:flex">
        {/*
         * Ambient showcase video. The source is small and soft, so it is scaled
         * up, blurred a touch and dimmed: it reads as atmosphere behind the
         * copy rather than as footage, and the scrims below keep the text at a
         * comfortable contrast over every frame.
         */}
        <video
          ref={videoRef}
          src="/media/signin-bg.mp4"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 size-full scale-105 object-cover opacity-70 blur-[1px]"
        />

        {/*
         * Scrims, weighted to the bottom: the footage stays visible across the
         * top of the panel, then darkens into near-solid canvas behind the copy
         * so the headline and list keep their contrast on every frame.
         */}
        <div className="pointer-events-none absolute inset-0 bg-canvas/20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/85 to-canvas/5" />
        <div className="aurora pointer-events-none absolute inset-0 opacity-70" />

        <Link
          href="/"
          aria-label="Back to home"
          // z-20: the copy column below is also z-10 and comes later in the
          // DOM, so at z-10 it won the stacking tie and swallowed these clicks.
          className="absolute left-6 top-6 z-20 grid size-10 place-items-center rounded-full border border-line bg-surface/60 text-ink-muted backdrop-blur-sm transition-colors hover:border-line-strong hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center justify-between gap-4">
            <Wordmark />
            <ThemeToggle />
          </div>

          <div className="max-w-md">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink xl:text-4xl">
              Trade with evidence, not memory.
            </h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-ink-muted xl:text-base">
              Every fill recorded, every session reviewed, every number worked out from your
              executions. Sign in to pick up where your journal left off.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-ink-muted">
              {['Your data stays yours', 'Import from any broker CSV', 'The review, locked in'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="grid size-5 place-items-center rounded-full bg-brand-soft text-brand">
                      <svg
                        viewBox="0 0 24 24"
                        className="size-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <p className="text-xs text-ink-subtle">
            © {new Date().getFullYear()} BMZ Trade Lab. Journalling software, not advice.
          </p>
        </div>
      </aside>

      {/* Right: the form */}
      <div className="relative flex flex-1 items-center justify-center bg-surface/30 px-6 py-12">
        {/* Compact top bar for small screens, where the showcase is hidden. */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-6 lg:hidden">
          <Wordmark small />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              aria-label="Back to home"
              className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Create one
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
              <div className="relative">
                <Input
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
        </div>
      </div>
    </main>
  );
}
