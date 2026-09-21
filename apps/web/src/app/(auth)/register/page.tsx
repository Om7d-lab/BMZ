import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Wordmark } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export const metadata: Metadata = { title: 'Create your account' };

export default function RegisterPage() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-6 py-12">
      <div className="aurora pointer-events-none absolute inset-0 -z-10" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Start your journal</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Free while we build it. No card, no trial clock.
          </p>

          <RegisterForm />

          <p className="mt-6 text-center text-xs text-ink-subtle">
            Already have an account?{' '}
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
