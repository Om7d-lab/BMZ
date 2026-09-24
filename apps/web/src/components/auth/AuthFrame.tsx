'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * The frame every auth screen shares: a brand showcase on the left (large
 * screens) and the page's form on the right.
 *
 * It is the auth route group's layout, so moving between sign-in, sign-up and
 * the password screens swaps only the form — the showcase, its video and the
 * header stay put instead of jumping to a different layout on every click.
 * The form column is top-aligned for the same reason: centring it would move
 * each page's heading up or down with the height of its form.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
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

  return (
    <main className="flex min-h-dvh">
      {/* Left: brand showcase (large screens only) */}
      <aside className="dark-scope relative hidden flex-1 overflow-hidden border-e border-line bg-canvas lg:flex">
        {/*
         * Ambient showcase video. The source is small and soft, so it is scaled
         * up, blurred a touch and dimmed: it reads as atmosphere behind the
         * copy rather than as footage.
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

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* One row, one baseline: back, brand, theme. */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackHome className="size-9 bg-surface/60 backdrop-blur-sm" />
              <Wordmark />
            </div>
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

      {/* Right: the page's form */}
      <div className="relative flex flex-1 flex-col bg-surface/30">
        {/* Compact top bar for small screens, where the showcase is hidden. */}
        <div className="flex items-center justify-between px-6 py-6 lg:hidden">
          <Wordmark small />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <BackHome className="size-9 bg-surface" />
          </div>
        </div>

        <div className="flex flex-1 justify-center px-6 pb-12 pt-6 lg:pt-[22vh]">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </main>
  );
}

function BackHome({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Back to home"
      className={`grid flex-none place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink ${className ?? ''}`}
    >
      <ArrowLeft className="size-4" />
    </Link>
  );
}

/** The heading block every auth form opens with, so they all line up. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {children ? <p className="mt-1.5 text-sm text-ink-muted">{children}</p> : null}
    </>
  );
}
