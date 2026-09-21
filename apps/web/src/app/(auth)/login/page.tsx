import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInPage } from '@/components/ui/sign-in-page';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  // SignInPage reads the `next` search param, so it needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <SignInPage />
    </Suspense>
  );
}
