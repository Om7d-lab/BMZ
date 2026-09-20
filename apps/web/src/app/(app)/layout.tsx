import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Account, SessionResponse } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { ApiRequestError } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Wordmark } from '../page';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session: SessionResponse;

  try {
    session = await serverApi<SessionResponse>('/auth/session');
  } catch (error) {
    // The middleware only checks that a cookie exists. This is where an expired
    // or revoked session actually gets caught.
    if (error instanceof ApiRequestError && error.isUnauthorized) redirect('/login');
    throw error;
  }

  const accounts = await serverApi<Account[]>('/accounts', {
    organizationId: session.activeOrganizationId,
  }).catch(() => [] as Account[]);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-e border-line bg-surface/40 p-4 lg:flex">
        <Link href="/dashboard" className="px-2 py-1">
          <Wordmark small />
        </Link>

        <Sidebar />

        <div className="mt-auto space-y-2 px-2">
          <Link
            href="/settings"
            className="block rounded-lg px-1 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Settings
          </Link>
          <p className="text-[11px] leading-relaxed text-ink-subtle">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} in{' '}
            {session.organizations[0]?.name ?? 'your workspace'}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
