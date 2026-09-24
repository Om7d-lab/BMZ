import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthHeading } from '@/components/auth/AuthFrame';
import { AuthDivider, GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export const metadata: Metadata = { title: 'Create your account' };

export default function RegisterPage() {
  return (
    <>
      {/* Mirrors sign-in, so the switch link sits in the same place on both. */}
      <AuthHeading title="Start your journal">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </AuthHeading>

      <GoogleSignInButton label="Sign up with Google" className="mt-8" />

      <div className="mt-6">
        <AuthDivider>or use your email</AuthDivider>
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-xs text-ink-subtle">
        Free while we build it. No card, no trial clock.
      </p>
    </>
  );
}
