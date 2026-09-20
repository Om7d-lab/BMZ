import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Account, Paginated, SessionResponse, Tag, Trade } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { queryString } from '@/lib/api';
import { Card, EmptyState } from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { TradeFilters } from '@/components/trades/TradeFilters';
import { TradeTable } from '@/components/trades/TradeTable';

export const metadata: Metadata = { title: 'Trades' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const one = (key: string): string | undefined =>
    typeof params[key] === 'string' ? params[key] : undefined;

  const accountId = one('account');
  const sortBy = one('sortBy') ?? 'openedAt';
  const sortDir = one('sortDir') === 'asc' ? 'asc' : 'desc';

  const session = await serverApi<SessionResponse>('/auth/session');
  const organizationId = session.activeOrganizationId;

  const [accounts, tags] = await Promise.all([
    serverApi<Account[]>('/accounts', { organizationId }),
    serverApi<Tag[]>('/tags', { organizationId }),
  ]);

  const account = accountId ? accounts.find((candidate) => candidate.id === accountId) : undefined;
  const currency = account?.currency ?? session.user.preferredCurrency;

  const query = queryString({
    accountId,
    search: one('search'),
    status: one('status'),
    direction: one('direction'),
    reviewStatus: one('reviewStatus'),
    tagIds: one('tagIds'),
    from: one('from'),
    to: one('to'),
    cursor: one('cursor'),
    sortBy,
    sortDir,
    limit: 50,
  });

  const page = await serverApi<Paginated<Trade>>(`/trades${query}`, { organizationId });

  function buildSortHref(field: string): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && key !== 'sortBy' && key !== 'sortDir' && key !== 'cursor') {
        next.set(key, value);
      }
    }
    next.set('sortBy', field);
    // Clicking the active column flips it; a new column starts descending,
    // which is what "most recent" and "biggest" both want.
    next.set('sortDir', sortBy === field && sortDir === 'desc' ? 'asc' : 'desc');
    return `/trades?${next.toString()}`;
  }

  return (
    <>
      <TopBar
        user={session.user}
        accounts={accounts}
        activeAccountId={accountId ?? null}
        title="Trades"
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Suspense fallback={null}>
            <TradeFilters tags={tags} />
          </Suspense>

          <Link
            href="/trades/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
          >
            Record a trade
          </Link>
        </div>

        <Card className="p-0">
          {page.items.length === 0 ? (
            <EmptyState
              title="No trades match"
              description="Either nothing has been recorded yet, or the filters above are too narrow."
              action={
                <Link href="/trades/new" className="text-sm text-brand hover:underline">
                  Record a trade
                </Link>
              }
            />
          ) : (
            <TradeTable
              trades={page.items}
              currency={currency}
              sortBy={sortBy}
              sortDir={sortDir}
              buildSortHref={buildSortHref}
            />
          )}
        </Card>

        {page.nextCursor ? (
          <div className="flex justify-center">
            <Link
              href={`/trades${queryString({ ...stringParams(params), cursor: page.nextCursor })}`}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-raised"
            >
              Load more
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

function stringParams(params: SearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && key !== 'cursor') result[key] = value;
  }
  return result;
}
