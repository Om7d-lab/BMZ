/**
 * The BMZ brand lockup, shared across the marketing page, the auth screens and
 * the app shell. Plain presentational components (no hooks), so they render in
 * both server and client contexts.
 */

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${small ? 'text-sm' : 'text-base'}`}>
      <BmzMark className={small ? 'size-7' : 'size-8'} />
      <span className="whitespace-nowrap font-semibold tracking-tight text-ink">BMZ Trade Lab</span>
    </span>
  );
}

/**
 * The BMZ mark: a rounded badge carrying the wordmark, with the central "M"
 * picked out in the brand teal. Drawn as an SVG so it stays crisp at every size
 * and follows the design tokens rather than baking in a fixed colour.
 */
export function BmzMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="BMZ">
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="11"
        fill="var(--color-surface)"
        stroke="var(--color-brand)"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <text
        x="20"
        y="20.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-sans)"
        fontWeight="800"
        fontSize="15"
        letterSpacing="-1.2"
      >
        <tspan fill="var(--color-ink)">B</tspan>
        <tspan fill="var(--color-brand)">M</tspan>
        <tspan fill="var(--color-ink)">Z</tspan>
      </text>
    </svg>
  );
}
