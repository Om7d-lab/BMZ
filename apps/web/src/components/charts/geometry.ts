/**
 * Chart geometry, kept out of the components so it can be unit-tested without
 * rendering anything.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Scale {
  min: number;
  max: number;
  /** Maps a data value onto a pixel position along the axis. */
  to(value: number): number;
}

export function linearScale(min: number, max: number, from: number, to: number): Scale {
  // A flat series would divide by zero; give it a band so the line sits mid-plot.
  const span = max - min || 1;
  return {
    min,
    max,
    to: (value) => from + ((value - min) / span) * (to - from),
  };
}

/**
 * Rounds an axis range out to comfortable bounds and returns the ticks to draw.
 * A "nice" step is 1, 2, 2.5 or 5 times a power of ten, which is what people
 * read a chart axis in.
 */
export function niceTicks(
  min: number,
  max: number,
  count = 4,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const base = Number.isFinite(min) ? min : 0;
    return { min: base - 1, max: base + 1, ticks: [base - 1, base, base + 1] };
  }

  const rawStep = (max - min) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step =
    (normalized > 5 ? 10 : normalized > 2.5 ? 5 : normalized > 2 ? 2.5 : normalized > 1 ? 2 : 1) *
    magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  // Half a step of slack absorbs floating-point drift at the top of the range.
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }

  return { min: niceMin, max: niceMax, ticks };
}

/** An SVG path through the points, as straight segments. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
}

/** The same path closed down to a baseline, for the area fill beneath it. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${last.x.toFixed(2)},${baselineY.toFixed(2)} L${first.x.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

/**
 * Thins a series to at most `limit` points, always keeping the first and last.
 *
 * A year of trades is more points than a 900-pixel-wide chart has pixels, and
 * drawing them all costs time without changing the picture.
 */
export function downsample<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];

  const step = (items.length - 1) / (limit - 1);
  const sampled: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(items[Math.round(index * step)]!);
  }
  return sampled;
}
