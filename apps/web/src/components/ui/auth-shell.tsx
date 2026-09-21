import Link from 'next/link';
import { Wordmark } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * The centred card frame the non-showcase auth screens share.
 *
 * The sign-in screen brings its own full-bleed split layout, so this is not in
 * the route group's layout — each page picks the frame it needs.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </main>
  );
}
