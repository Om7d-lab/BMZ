import { redirect } from 'next/navigation';
import type { Account, SessionResponse } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { ApiRequestError } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session: SessionResponse;

  try {
    session = await serverApi<SessionResponse>('/auth/session');
  } catch (error) {
    // The proxy only checks that a cookie exists. This is where a revoked or
    // otherwise dead session actually gets caught. The flag stops the proxy
    // from bouncing a browser that still holds those cookies straight back.
    if (error instanceof ApiRequestError && error.isUnauthorized) {
      redirect('/login?session=expired');
    }
    throw error;
  }

  const accounts = await serverApi<Account[]>('/accounts', {
    organizationId: session.activeOrganizationId,
  }).catch(() => [] as Account[]);

  return (
    // The rail brings its own chrome: an expanding column on a wide screen, and
    // a menu button plus drawer below `md` — which is the only navigation this
    // app offers on a phone, so the column stacks rather than sitting beside.
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        accountCount={accounts.length}
        workspaceName={session.organizations[0]?.name ?? 'your workspace'}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
