import type { Metadata } from 'next';
import Link from 'next/link';
import type { Account, CalendarResponse, DashboardOverview, SessionResponse } from '@bmz/contracts';
import { serverApi } from '@/lib/server-api';
import { queryString } from '@/lib/api';
import {
  formatDuration,
  formatMaybeCurrency,
  formatPercent,
  formatRatio,
  formatSignedCurrency,
  pnlClass,
  pnlTone,
} from '@/lib/format';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { EquityCurve } from '@/components/charts/EquityCurve';
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const accountId = typeof params.account === 'string' ? params.account : undefined;

  const session = await serverApi<SessionResponse>('/auth/session');
  const organizationId = session.activeOrganizationId;

  const accounts = await serverApi<Account[]>('/accounts', { organizationId });
  const account = accountId ? accounts.find((candidate) => candidate.id === accountId) : undefined;
  const currency = account?.currency ?? session.user.preferredCurrency;

  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = lastDayOfMonth(now);

  const [overview, calendar] = await Promise.all([
    serverApi<DashboardOverview>(`/analytics/overview${queryString({ accountId })}`, {
      organizationId,
    }),
    serverApi<CalendarResponse>(
      `/analytics/calendar${queryString({ from: monthStart, to: monthEnd, accountId })}`,
      { organizationId },
    ),
  ]);

  const { summary, equityCurve, recentTrades, openTradeCount } = overview;
  const hasTrades = summary.tradeCount > 0 || openTradeCount > 0;

  return (
    <>
      <TopBar
        user={session.user}
        accounts={accounts}
        activeAccountId={accountId ?? null}
        title="Dashboard"
      />

      <div className="space-y-4 p-6">
        {!hasTrades ? (
          <Card>
            <EmptyState
              title="Your journal is empty"
              description="Record your first trade and the dashboard fills itself in: equity curve, win rate, expectancy, and the calendar below."
              action={
                <Link
                  href="/trades/new"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
                >
                  Record a trade
                </Link>
              }
            />
          </Card>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Net P&L"
            value={formatSignedCurrency(summary.netPnl, currency)}
            tone={pnlTone(summary.netPnl)}
            sub={`${summary.tradeCount} closed${openTradeCount > 0 ? `, ${openTradeCount} open` : ''}`}
          />
          <Stat
            label="Win rate"
            value={formatPercent(summary.winRate)}
            sub={`${summary.wins}W · ${summary.losses}L${summary.breakEven > 0 ? ` · ${summary.breakEven}BE` : ''}`}
          />
          <Stat
            label="Profit factor"
            value={formatRatio(summary.profitFactor)}
            sub={`${formatMaybeCurrency(summary.grossProfit, currency)} won against ${formatMaybeCurrency(summary.grossLoss, currency)} lost`}
          />
          <Stat
            label="Expectancy"
            value={formatSignedCurrency(summary.expectancy, currency)}
            tone={pnlTone(summary.expectancy)}
            sub="Per trade that resolved"
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Account equity"
              description={`From ${formatMaybeCurrency(equityCurve.startingBalance, currency)} to ${formatMaybeCurrency(equityCurve.endingEquity, currency)}. Deepest drawdown ${formatMaybeCurrency(equityCurve.maxDrawdown, currency)}${equityCurve.maxDrawdownPercent ? ` (${formatPercent(equityCurve.maxDrawdownPercent)})` : ''}.`}
            />
            <EquityCurve
              points={equityCurve.points}
              startingBalance={equityCurve.startingBalance}
              currency={currency}
            />
          </Card>

          <Card>
            <CardHeader title="Risk and rhythm" />
            <dl className="space-y-3 text-sm">
              <Row
                label="Average R"
                value={summary.averageRMultiple ? `${formatRatio(summary.averageRMultiple)}R` : '—'}
              />
              <Row label="Average win" value={formatMaybeCurrency(summary.averageWin, currency)} />
              <Row
                label="Average loss"
                value={formatMaybeCurrency(summary.averageLoss, currency)}
              />
              <Row label="Largest win" value={formatMaybeCurrency(summary.largestWin, currency)} />
              <Row
                label="Largest loss"
                value={formatMaybeCurrency(summary.largestLoss, currency)}
              />
              <Row label="Average hold" value={formatDuration(summary.averageDurationMs)} />
              <Row label="Fees paid" value={formatMaybeCurrency(summary.totalFees, currency)} />
              <Row
                label="Longest streak"
                value={`${summary.longestWinStreak}W / ${summary.longestLossStreak}L`}
              />
              {summary.currentStreak ? (
                <Row
                  label="Right now"
                  value={`${summary.currentStreak.length} ${summary.currentStreak.outcome === 'WIN' ? 'wins' : 'losses'} in a row`}
                />
              ) : null}
            </dl>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="This month"
              description={`Daily net result in ${calendar.timezone}. A dot marks a day you journalled.`}
            />
            <CalendarHeatmap
              days={calendar.days}
              currency={currency}
              monthLabel={now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            />
          </Card>

          <Card>
            <CardHeader
              title="Recent trades"
              action={
                <Link href="/trades" className="text-xs text-brand hover:underline">
                  See all
                </Link>
              }
            />
            {recentTrades.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-subtle">Nothing closed yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentTrades.map((trade) => (
                  <li key={trade.id}>
                    <Link
                      href={`/trades/${trade.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-ink"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {trade.symbol}
                        </span>
                        <span className="text-[11px] text-ink-subtle">
                          {trade.direction === 'LONG' ? 'Long' : 'Short'}
                          {trade.closedAt
                            ? ` · ${new Date(trade.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : ''}
                        </span>
                      </span>
                      <span className="text-end">
                        <span
                          className={`numeric block text-sm font-semibold ${pnlClass(trade.netPnl)}`}
                        >
                          {formatSignedCurrency(trade.netPnl, currency)}
                        </span>
                        {trade.rMultiple ? (
                          <span className="numeric text-[11px] text-ink-subtle">
                            {formatRatio(trade.rMultiple)}R
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="numeric font-medium text-ink">{value}</dd>
    </div>
  );
}

function lastDayOfMonth(date: Date): string {
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}
