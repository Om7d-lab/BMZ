import Link from 'next/link';
import clsx from 'clsx';
import type { Trade } from '@bmz/contracts';
import {
  formatDuration,
  formatPrice,
  formatRatio,
  formatSignedCurrency,
  pnlClass,
} from '@/lib/format';
import { Badge } from '@/components/ui';

/**
 * The trade list.
 *
 * Renders as a real table so it is navigable by screen reader and sortable by
 * column header. Money columns are end-aligned and tabular, which is the only
 * way a column of figures is scannable.
 */
export function TradeTable({
  trades,
  currency = 'USD',
  sortBy,
  sortDir,
  buildSortHref,
}: {
  trades: Trade[];
  currency?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  buildSortHref: (field: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-start text-xs text-ink-subtle">
            <SortableHeader
              field="openedAt"
              label="Opened"
              {...{ sortBy, sortDir, buildSortHref }}
            />
            <SortableHeader field="symbol" label="Symbol" {...{ sortBy, sortDir, buildSortHref }} />
            <th scope="col" className="px-3 py-2 text-start font-medium">
              Side
            </th>
            <th scope="col" className="px-3 py-2 text-end font-medium">
              Entry
            </th>
            <th scope="col" className="px-3 py-2 text-end font-medium">
              Exit
            </th>
            <th scope="col" className="px-3 py-2 text-end font-medium">
              Size
            </th>
            <SortableHeader
              field="netPnl"
              label="Net P&L"
              align="end"
              {...{ sortBy, sortDir, buildSortHref }}
            />
            <SortableHeader
              field="rMultiple"
              label="R"
              align="end"
              {...{ sortBy, sortDir, buildSortHref }}
            />
            <SortableHeader
              field="durationMs"
              label="Held"
              align="end"
              {...{ sortBy, sortDir, buildSortHref }}
            />
            <th scope="col" className="px-3 py-2 text-start font-medium">
              Tags
            </th>
          </tr>
        </thead>

        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-b border-line/60 transition-colors hover:bg-surface-raised/60"
            >
              <td className="px-3 py-2.5">
                <Link href={`/trades/${trade.id}`} className="block text-ink-muted hover:text-ink">
                  <span className="numeric block text-xs">
                    {new Date(trade.openedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                    })}
                  </span>
                  <span className="numeric text-[11px] text-ink-subtle">
                    {new Date(trade.openedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </Link>
              </td>

              <td className="px-3 py-2.5">
                <Link
                  href={`/trades/${trade.id}`}
                  className="font-medium text-ink hover:text-brand"
                >
                  {trade.symbol}
                </Link>
                <span className="block text-[11px] text-ink-subtle">
                  {titleCase(trade.instrumentClass)}
                </span>
              </td>

              <td className="px-3 py-2.5">
                <Badge tone={trade.direction === 'LONG' ? 'brand' : 'neutral'}>
                  {trade.direction === 'LONG' ? 'Long' : 'Short'}
                </Badge>
                {trade.status === 'OPEN' ? (
                  <Badge tone="warning" className="ms-1">
                    Open
                  </Badge>
                ) : null}
              </td>

              <td className="numeric px-3 py-2.5 text-end text-ink-muted">
                {formatPrice(trade.averageEntryPrice, trade.instrumentClass)}
              </td>
              <td className="numeric px-3 py-2.5 text-end text-ink-muted">
                {formatPrice(trade.averageExitPrice, trade.instrumentClass)}
              </td>
              <td className="numeric px-3 py-2.5 text-end text-ink-muted">
                {Number(trade.peakQuantity).toLocaleString('en-US')}
              </td>

              <td
                className={clsx(
                  'numeric px-3 py-2.5 text-end font-semibold',
                  pnlClass(trade.netPnl),
                )}
              >
                {formatSignedCurrency(trade.netPnl, currency)}
              </td>

              <td className={clsx('numeric px-3 py-2.5 text-end', pnlClass(trade.rMultiple))}>
                {trade.rMultiple ? `${formatRatio(trade.rMultiple)}R` : '—'}
              </td>

              <td className="numeric px-3 py-2.5 text-end text-ink-subtle">
                {formatDuration(trade.durationMs)}
              </td>

              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {trade.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      tone={tag.category === 'MISTAKE' ? 'loss' : 'neutral'}
                      style={
                        tag.color && tag.category !== 'MISTAKE' ? { color: tag.color } : undefined
                      }
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {trade.tags.length > 3 ? (
                    <span className="text-[11px] text-ink-subtle">+{trade.tags.length - 3}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  field,
  label,
  align = 'start',
  sortBy,
  sortDir,
  buildSortHref,
}: {
  field: string;
  label: string;
  align?: 'start' | 'end';
  sortBy: string;
  sortDir: 'asc' | 'desc';
  buildSortHref: (field: string) => string;
}) {
  const isActive = sortBy === field;

  return (
    <th
      scope="col"
      className={clsx('px-3 py-2 font-medium', align === 'end' ? 'text-end' : 'text-start')}
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        href={buildSortHref(field)}
        className={clsx('inline-flex items-center gap-1 hover:text-ink', isActive && 'text-ink')}
      >
        {label}
        {isActive ? <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
      </Link>
    </th>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
