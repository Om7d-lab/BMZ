import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import type { Account, SessionResponse, Trade } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { ApiRequestError } from '@/lib/api';
import {
  formatDuration,
  formatMaybeCurrency,
  formatPercent,
  formatPrice,
  formatRatio,
  formatSignedCurrency,
  pnlTone,
} from '@/lib/format';
import { Badge, Card, CardHeader, Stat } from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { TradeReviewPanel } from '@/components/trades/TradeReviewPanel';

export const metadata: Metadata = { title: 'Trade' };

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await serverApi<SessionResponse>('/auth/session');
  const organizationId = session.activeOrganizationId;

  let trade: Trade;
  try {
    trade = await serverApi<Trade>(`/trades/${id}`, { organizationId });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const accounts = await serverApi<Account[]>('/accounts', { organizationId });
  const account = accounts.find((candidate) => candidate.id === trade.accountId);
  const currency = account?.currency ?? session.user.preferredCurrency;

  const executions = trade.executions ?? [];

  return (
    <>
      <TopBar
        user={session.user}
        accounts={accounts}
        activeAccountId={trade.accountId}
        title={`${trade.symbol} · ${trade.direction === 'LONG' ? 'Long' : 'Short'}`}
      />

      <div className="space-y-4 p-6">
        <Link href="/trades" className="text-xs text-ink-subtle hover:text-ink">
          ← Back to trades
        </Link>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Net P&L"
            value={formatSignedCurrency(trade.netPnl, currency)}
            tone={pnlTone(trade.netPnl)}
            sub={`${formatMaybeCurrency(trade.grossPnl, currency)} gross, ${formatMaybeCurrency(trade.fees, currency)} in fees`}
          />
          <Stat
            label="R-multiple"
            value={trade.rMultiple ? `${formatRatio(trade.rMultiple)}R` : '—'}
            tone={pnlTone(trade.rMultiple)}
            sub={
              trade.initialRisk
                ? `Risked ${formatMaybeCurrency(trade.initialRisk, currency)}`
                : 'No stop recorded, so there is no R'
            }
          />
          <Stat
            label="Return"
            value={trade.netReturn ? formatPercent(trade.netReturn, 'en', 2) : '—'}
            tone={pnlTone(trade.netReturn)}
            sub="On capital committed"
          />
          <Stat
            label="Held for"
            value={formatDuration(trade.durationMs)}
            sub={trade.status === 'OPEN' ? 'Still open' : 'Closed'}
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2 p-0">
            <div className="p-5">
              <CardHeader
                title="Executions"
                description="Every fill, in the order it happened. P&L is matched first in, first out."
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-line text-xs text-ink-subtle">
                    <th scope="col" className="px-5 py-2 text-start font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      Side
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      Quantity
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      Price
                    </th>
                    <th scope="col" className="px-5 py-2 text-end font-medium">
                      Fees
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id} className="border-b border-line/60">
                      <td className="numeric px-5 py-2.5 text-xs text-ink-muted">
                        {new Date(execution.executedAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={execution.side === 'BUY' ? 'brand' : 'neutral'}>
                          {execution.side === 'BUY' ? 'Buy' : 'Sell'}
                        </Badge>
                      </td>
                      <td className="numeric px-3 py-2.5 text-end text-ink">
                        {Number(execution.quantity).toLocaleString('en-US')}
                      </td>
                      <td className="numeric px-3 py-2.5 text-end text-ink">
                        {formatPrice(execution.price, trade.instrumentClass)}
                      </td>
                      <td className="numeric px-5 py-2.5 text-end text-ink-subtle">
                        {formatMaybeCurrency(execution.fees, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="grid grid-cols-2 gap-4 border-t border-line p-5 text-sm sm:grid-cols-4">
              <Figure
                label="Average entry"
                value={formatPrice(trade.averageEntryPrice, trade.instrumentClass)}
              />
              <Figure
                label="Average exit"
                value={formatPrice(trade.averageExitPrice, trade.instrumentClass)}
              />
              <Figure label="Stop" value={formatPrice(trade.stopLoss, trade.instrumentClass)} />
              <Figure label="Target" value={formatPrice(trade.takeProfit, trade.instrumentClass)} />
              <Figure
                label="Peak size"
                value={Number(trade.peakQuantity).toLocaleString('en-US')}
              />
              <Figure
                label="Multiplier"
                value={`×${Number(trade.multiplier).toLocaleString('en-US')}`}
              />
              <Figure
                label="Planned R:R"
                value={trade.plannedRewardRisk ? `${formatRatio(trade.plannedRewardRisk)}:1` : '—'}
              />
              <Figure label="Account" value={account?.name ?? '—'} />
            </dl>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Tags" />
              {trade.tags.length === 0 ? (
                <p className="text-xs text-ink-subtle">Nothing tagged yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {trade.tags.map((tag) => (
                    <Badge key={tag.id} tone={tag.category === 'MISTAKE' ? 'loss' : 'neutral'}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <TradeReviewPanel
              tradeId={trade.id}
              organizationId={organizationId}
              initialNotes={trade.notes ?? ''}
              initialRating={trade.rating}
              initialReviewStatus={trade.reviewStatus}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-subtle">{label}</dt>
      <dd className={clsx('numeric mt-0.5 font-medium text-ink')}>{value}</dd>
    </div>
  );
}
