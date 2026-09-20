import Link from 'next/link';
import { Wordmark } from '../page';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-6 py-12">
      <div className="aurora pointer-events-none absolute inset-0 -z-10" />
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Wordmark />
        </Link>
        {children}
      </div>
    </main>
  );
}
