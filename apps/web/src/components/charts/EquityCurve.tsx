'use client';

import { useMemo, useState } from 'react';
import type { EquityPoint } from '@bmz/contracts';
import { formatCurrency } from '@/lib/format';
import { areaPath, downsample, linearScale, linePath, niceTicks, type Point } from './geometry';

const WIDTH = 900;
const HEIGHT = 280;
const PADDING = { top: 16, right: 16, bottom: 28, left: 64 };

/**
 * Account equity over time.
 *
 * One series, so there is no legend: the card's own heading names what the
 * line is. The starting balance is drawn as a reference line, because the only
 * question this chart answers is whether the account is above or below where it
 * began, and by how much.
 */
export function EquityCurve({
  points,
  startingBalance,
  currency = 'USD',
}: {
  points: EquityPoint[];
  startingBalance: string;
  currency?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    // A year of trades is more points than the chart has pixels.
    const sampled = downsample(points, 240);
    const values = sampled.map((point) => Number(point.equity));
    const baseline = Number(startingBalance);

    const { min, max, ticks } = niceTicks(
      Math.min(baseline, ...values),
      Math.max(baseline, ...values),
      4,
    );

    const x = linearScale(0, Math.max(1, sampled.length - 1), PADDING.left, WIDTH - PADDING.right);
    const y = linearScale(min, max, HEIGHT - PADDING.bottom, PADDING.top);

    const coordinates: Point[] = sampled.map((point, index) => ({
      x: x.to(index),
      y: y.to(Number(point.equity)),
    }));

    // Three or four dates along the bottom: enough to place the curve in time,
    // few enough that the labels never collide at narrow widths.
    const labelCount = Math.min(4, sampled.length);
    const dateTicks =
      labelCount < 2
        ? []
        : Array.from({ length: labelCount }, (_, step) => {
            const index = Math.round((step * (sampled.length - 1)) / (labelCount - 1));
            return { index, at: sampled[index]!.at };
          });

    return { sampled, coordinates, x, y, ticks, baseline, dateTicks };
  }, [points, startingBalance]);

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-xs text-ink-subtle">
        No closed trades yet. The curve appears once a trade is recorded.
      </div>
    );
  }

  const { sampled, coordinates, x, y, ticks, baseline, dateTicks } = chart;
  const baselineY = y.to(baseline);
  const last = sampled.at(-1)!;
  const isUp = Number(last.equity) >= baseline;
  const hovered = hoverIndex === null ? null : sampled[hoverIndex];

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[280px] w-full"
        role="img"
        aria-label={`Account equity from ${formatCurrency(baseline, currency)} to ${formatCurrency(last.equity, currency)}`}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          // Convert the pointer position into viewBox units before inverting.
          const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          const ratio = (svgX - PADDING.left) / (WIDTH - PADDING.left - PADDING.right);
          const index = Math.round(ratio * (sampled.length - 1));
          setHoverIndex(Math.max(0, Math.min(sampled.length - 1, index)));
        }}
      >
        <defs>
          <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid and axis, recessive: the line is the subject. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y.to(tick)}
              y2={y.to(tick)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 10}
              y={y.to(tick) + 4}
              textAnchor="end"
              className="numeric"
              fill="var(--color-ink-subtle)"
              fontSize={11}
            >
              {formatCurrency(tick, currency, 'en', { compact: true })}
            </text>
          </g>
        ))}

        {/* Where the account started. Everything above this line is profit. */}
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--color-ink-subtle)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        <path d={areaPath(coordinates, baselineY)} fill="url(#equity-fill)" />
        <path
          d={linePath(coordinates)}
          fill="none"
          stroke={isUp ? 'var(--color-brand)' : 'var(--color-loss)'}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {dateTicks.map((tick, position) => (
          <text
            key={tick.index}
            x={x.to(tick.index)}
            y={HEIGHT - 8}
            // The first and last labels are anchored inward so neither runs
            // off the edge of the plot.
            textAnchor={
              position === 0 ? 'start' : position === dateTicks.length - 1 ? 'end' : 'middle'
            }
            className="numeric"
            fill="var(--color-ink-subtle)"
            fontSize={11}
          >
            {new Date(tick.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {hoverIndex !== null && hovered ? (
          <g pointerEvents="none">
            <line
              x1={x.to(hoverIndex)}
              x2={x.to(hoverIndex)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
            />
            <circle
              cx={x.to(hoverIndex)}
              cy={y.to(Number(hovered.equity))}
              r={5}
              fill={isUp ? 'var(--color-brand)' : 'var(--color-loss)'}
              // A ring in the surface colour keeps the marker legible over the line.
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {hovered ? (
        <div className="pointer-events-none absolute left-16 top-2 rounded-lg border border-line bg-surface-overlay px-3 py-2 text-xs shadow-lg">
          <p className="text-ink-subtle">
            {new Date(hovered.at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
          <p className="numeric mt-0.5 font-semibold text-ink">
            {formatCurrency(hovered.equity, currency)}
          </p>
          <p className="numeric text-ink-muted">
            {formatCurrency(hovered.cumulativePnl, currency, 'en', { signDisplay: 'always' })} since
            the start
          </p>
        </div>
      ) : null}

      <figcaption className="sr-only">
        Account equity from {formatCurrency(baseline, currency)} to{' '}
        {formatCurrency(last.equity, currency)} across {points.length} closed trades.
      </figcaption>
    </figure>
  );
}
