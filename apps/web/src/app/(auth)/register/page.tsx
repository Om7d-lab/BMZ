import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthShell } from '@/components/ui/auth-shell';
import { AuthDivider, GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export const metadata: Metadata = { title: 'Create your account' };

export default function RegisterPage() {
  return (
    <AuthShell>
      <div className="card p-6">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Start your journal</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Free while we build it. No card, no trial clock.
        </p>

        <GoogleSignInButton label="Sign up with Google" className="mt-6" />

        <div className="mt-6">
          <AuthDivider>or use your email</AuthDivider>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-xs text-ink-subtle">
          Already have an account?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
