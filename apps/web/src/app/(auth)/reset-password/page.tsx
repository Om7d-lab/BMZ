import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  // The form reads the `token` search param, so it needs a Suspense boundary.
  return (
    <>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
