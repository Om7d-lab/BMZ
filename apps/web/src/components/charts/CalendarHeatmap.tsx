import clsx from 'clsx';
import type { CalendarDay } from '@bmz/contracts';
import { formatCurrency } from '@/lib/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * A month of daily results.
 *
 * The scale is diverging around zero, and intensity within each side is scaled
 * to the month's largest absolute day so a quiet month is not washed out. Every
 * cell also carries its signed figure: the colour is reinforcement, never the
 * only way to read whether a day was green or red.
 */
export function CalendarHeatmap({
  days,
  currency = 'USD',
  monthLabel,
}: {
  days: CalendarDay[];
  currency?: string;
  monthLabel: string;
}) {
  const traded = days.filter((day) => day.tradeCount > 0);
  const peak = Math.max(1, ...traded.map((day) => Math.abs(Number(day.netPnl))));

  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = days[0];
  if (!first) return null;

  // Weeks run Monday to Sunday; getUTCDay puts Sunday at 0, so shift it to 6.
  const firstWeekday = (new Date(`${first.date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
  const cells: Array<CalendarDay | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...days.map((day) => byDate.get(day.date) ?? null),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{monthLabel}</p>
        <Legend currency={currency} peak={peak} />
      </div>

      <div
        className="grid grid-cols-7 gap-1.5"
        role="grid"
        aria-label={`Daily results for ${monthLabel}`}
      >
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-1 text-center text-[11px] font-medium text-ink-subtle">
            {weekday}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) return <div key={`pad-${index}`} aria-hidden />;
          return <DayCell key={day.date} day={day} peak={peak} currency={currency} />;
        })}
      </div>
    </div>
  );
}

function DayCell({ day, peak, currency }: { day: CalendarDay; peak: number; currency: string }) {
  const value = Number(day.netPnl);
  const dayOfMonth = Number(day.date.slice(8, 10));
  const hasTrades = day.tradeCount > 0;

  // Square-rooting the ratio keeps a modest day visible rather than letting one
  // outlier flatten the rest of the month to near-black.
  const intensity = hasTrades ? Math.sqrt(Math.min(1, Math.abs(value) / peak)) : 0;
  const tone = value > 0 ? 'profit' : value < 0 ? 'loss' : 'flat';

  const background = !hasTrades
    ? 'transparent'
    : tone === 'flat'
      ? 'var(--color-surface-raised)'
      : `color-mix(in oklab, var(--color-chart-${tone}) ${Math.round(18 + intensity * 62)}%, var(--color-surface))`;

  return (
    <div
      role="gridcell"
      title={
        hasTrades
          ? `${day.date}: ${formatCurrency(day.netPnl, currency, 'en', { signDisplay: 'always' })} over ${day.tradeCount} ${day.tradeCount === 1 ? 'trade' : 'trades'}`
          : `${day.date}: no trades`
      }
      className={clsx(
        'relative flex aspect-square flex-col justify-between rounded-md border p-1.5 transition-colors',
        hasTrades ? 'border-line-strong' : 'border-line/50',
      )}
      style={{ backgroundColor: background }}
    >
      <span
        className={clsx(
          'numeric text-[11px]',
          hasTrades ? 'text-ink' : 'text-ink-subtle',
          day.isLocked && 'font-semibold',
        )}
      >
        {dayOfMonth}
      </span>

      {hasTrades ? (
        <span className="numeric truncate text-[11px] font-semibold text-ink">
          {formatCurrency(day.netPnl, currency, 'en', { signDisplay: 'always', compact: true })}
        </span>
      ) : null}

      {day.hasJournal ? (
        <span
          className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent"
          title="Journalled"
        />
      ) : null}
    </div>
  );
}

function Legend({ currency, peak }: { currency: string; peak: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
      <span className="numeric">-{formatCurrency(peak, currency, 'en', { compact: true })}</span>
      <span className="flex gap-0.5">
        {[80, 45, 20].map((step) => (
          <span
            key={`loss-${step}`}
            className="size-3 rounded-sm"
            style={{
              backgroundColor: `color-mix(in oklab, var(--color-chart-loss) ${step}%, var(--color-surface))`,
            }}
          />
        ))}
        <span className="size-3 rounded-sm bg-surface-raised" />
        {[20, 45, 80].map((step) => (
          <span
            key={`profit-${step}`}
            className="size-3 rounded-sm"
            style={{
              backgroundColor: `color-mix(in oklab, var(--color-chart-profit) ${step}%, var(--color-surface))`,
            }}
          />
        ))}
      </span>
      <span className="numeric">+{formatCurrency(peak, currency, 'en', { compact: true })}</span>
    </div>
  );
}
