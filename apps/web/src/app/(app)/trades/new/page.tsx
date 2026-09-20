import type { Metadata } from 'next';
import type { Account, SessionResponse, Tag } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { TopBar } from '@/components/layout/TopBar';
import { TradeForm } from '@/components/trades/TradeForm';

export const metadata: Metadata = { title: 'Record a trade' };

export default async function NewTradePage() {
  const session = await serverApi<SessionResponse>('/auth/session');
  const organizationId = session.activeOrganizationId;

  const [accounts, tags] = await Promise.all([
    serverApi<Account[]>('/accounts', { organizationId }),
    serverApi<Tag[]>('/tags', { organizationId }),
  ]);

  return (
    <>
      <TopBar
        user={session.user}
        accounts={accounts}
        activeAccountId={null}
        title="Record a trade"
      />

      <div className="p-6">
        <TradeForm accounts={accounts} tags={tags} organizationId={organizationId} />
      </div>
    </>
  );
}
