import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to your journal.</p>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        No account yet?{' '}
        <Link href="/register" className="text-brand hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
