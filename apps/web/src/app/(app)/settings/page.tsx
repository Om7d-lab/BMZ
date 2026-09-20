import type { Metadata } from 'next';
import type { Account, SessionResponse } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { formatMaybeCurrency, formatSignedCurrency, pnlClass } from '@/lib/format';
import { Badge, Card, CardHeader } from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { AccountForm } from '@/components/settings/AccountForm';

export const metadata: Metadata = { title: 'Settings' };

interface EntitlementsResponse {
  entitlements: Array<{ feature: string; enabled: boolean; limit: number | null }>;
}

export default async function SettingsPage() {
  const session = await serverApi<SessionResponse>('/auth/session');
  const organizationId = session.activeOrganizationId;

  const [accounts, { entitlements }] = await Promise.all([
    serverApi<Account[]>(`/accounts?includeArchived=true`, { organizationId }),
    serverApi<EntitlementsResponse>('/organizations/current/entitlements', { organizationId }),
  ]);

  return (
    <>
      <TopBar user={session.user} accounts={[]} activeAccountId={null} title="Settings" />

      <div className="grid gap-4 p-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Profile"
            description="Your timezone decides which calendar day a trade lands on, so it is worth getting right."
          />
          <ProfileForm user={session.user} />
        </Card>

        <Card>
          <CardHeader title="Add a trading account" />
          <AccountForm organizationId={organizationId} defaultTimezone={session.user.timezone} />
        </Card>

        <Card className="xl:col-span-2 p-0">
          <div className="p-5">
            <CardHeader title="Trading accounts" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-line text-xs text-ink-subtle">
                  <th scope="col" className="px-5 py-2 text-start font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    Timezone
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    Trades
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    Net P&L
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-medium">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-line/60">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-ink">{account.name}</span>
                      {account.isArchived ? <Badge className="ms-2">Archived</Badge> : null}
                      {account.broker ? (
                        <span className="block text-[11px] text-ink-subtle">{account.broker}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{accountTypeLabel(account.type)}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-subtle">{account.timezone}</td>
                    <td className="numeric px-3 py-2.5 text-end text-ink-muted">
                      {account.tradeCount ?? 0}
                    </td>
                    <td
                      className={`numeric px-3 py-2.5 text-end font-medium ${pnlClass(account.netPnl)}`}
                    >
                      {formatSignedCurrency(account.netPnl, account.currency)}
                    </td>
                    <td className="numeric px-5 py-2.5 text-end text-ink">
                      {formatMaybeCurrency(
                        account.currentBalance ?? account.startingBalance,
                        account.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="What your plan includes"
            description="Everything is free while we build this. Features not yet released are listed so you can see what is coming."
          />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entitlements.map((entitlement) => {
              const available = entitlement.enabled && entitlement.limit !== 0;
              return (
                <li
                  key={entitlement.feature}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-raised/40 px-3 py-2 text-sm"
                >
                  <span className={available ? 'text-ink' : 'text-ink-subtle'}>
                    {featureLabel(entitlement.feature)}
                  </span>
                  <Badge tone={available ? 'brand' : 'neutral'}>
                    {!available
                      ? 'Not yet'
                      : entitlement.limit === null
                        ? 'Unlimited'
                        : String(entitlement.limit)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}

function accountTypeLabel(type: Account['type']): string {
  switch (type) {
    case 'LIVE':
      return 'Live';
    case 'PAPER':
      return 'Paper';
    case 'PROP_EVALUATION':
      return 'Prop evaluation';
    case 'PROP_FUNDED':
      return 'Prop funded';
    default:
      return 'Backtest';
  }
}

function featureLabel(feature: string): string {
  const words = feature.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
