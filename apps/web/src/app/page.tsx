import Link from 'next/link';

/**
 * The marketing landing page.
 *
 * It establishes the brand and the one claim the product makes, backs it with an
 * illustrative snapshot — an equity curve and a few metric tiles — and gives one
 * clear path to sign up. Feature pages, the integration directory and pricing
 * arrive with the marketing stage.
 */
export default function LandingPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div className="aurora pointer-events-none absolute inset-0 -z-10" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />
          Free while we build it with you
        </p>

        <h1
          className="rise text-balance text-4xl font-semibold tracking-tight text-ink sm:text-6xl"
          style={{ '--rise-delay': '60ms' } as React.CSSProperties}
        >
          Trade with evidence, not memory.
        </h1>

        <p
          className="rise mx-auto mt-6 max-w-xl text-pretty text-base text-ink-muted sm:text-lg"
          style={{ '--rise-delay': '120ms' } as React.CSSProperties}
        >
          BMZ Trade Lab records every fill, works out what each decision actually cost you, and
          shows you the patterns you would never spot by scrolling back through a broker statement.
        </p>

        <div
          className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ '--rise-delay': '180ms' } as React.CSSProperties}
        >
          <Link
            href="/register"
            className="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong sm:w-auto"
          >
            Create your journal
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-line bg-surface px-6 py-3 text-sm text-ink transition-colors hover:border-line-strong hover:bg-surface-raised sm:w-auto"
          >
            Sign in
          </Link>
        </div>

        <p
          className="rise mt-4 text-xs text-ink-subtle"
          style={{ '--rise-delay': '240ms' } as React.CSSProperties}
        >
          Stocks, futures, forex, crypto and options. No card needed.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <HeroPreview />
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        <Feature
          icon={<ReceiptIcon />}
          title="Every fill, not every guess"
          body="Enter trades by hand or import a broker CSV. P&L, R-multiples and holding periods are worked out from the executions, so the numbers are the broker's, not yours."
        />
        <Feature
          icon={<NotebookIcon />}
          title="The review you keep skipping"
          body="A day view, a notebook and playbook rules that get checked against the trade you actually took. Lock the end-of-day review and the streak starts meaning something."
        />
        <Feature
          icon={<InsightIcon />}
          title="Answers, not dashboards"
          body="Which setup pays. Which hour costs you. What the tag 'chased the entry' has cost you this quarter. Filter it any way you like."
        />
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-ink-subtle sm:flex-row">
          <Wordmark small />
          <p>© {new Date().getFullYear()} BMZ Trade Lab. Journalling software, not advice.</p>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-6 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-raised">
      <span className="mb-4 grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

/**
 * An illustrative snapshot of the product — an equity curve and three metric
 * tiles. The figures are a sample, labelled as such, so the hero shows the shape
 * of the app without pretending to be anyone's real account.
 */
function HeroPreview() {
  return (
    <div
      className="card rise overflow-hidden"
      style={{ '--rise-delay': '300ms' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-loss/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-warning/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-profit/70" aria-hidden />
          <span className="ms-3 text-xs text-ink-subtle">Dashboard — last 30 days</span>
        </div>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">
          Example
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[1.6fr_1fr]">
        <EquityCurvePreview />

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
          <Metric label="Net P&L" value="+$4,820" tone="profit" />
          <Metric label="Win rate" value="58%" />
          <Metric label="Profit factor" value="1.9" tone="profit" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'profit' }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p
        className={`numeric mt-1 text-xl font-semibold ${tone === 'profit' ? 'text-profit' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}

function EquityCurvePreview() {
  // A smooth, gently rising sample equity path. Purely decorative.
  const line =
    'M0,150 C40,140 70,120 110,124 C150,128 175,96 215,92 C255,88 285,104 320,84 C355,64 380,40 420,34 C460,28 490,44 520,20';
  const area = `${line} L520,180 L0,180 Z`;

  return (
    <div className="rounded-lg border border-line bg-surface-raised/40 p-4">
      <svg
        viewBox="0 0 520 180"
        className="h-40 w-full"
        role="img"
        aria-label="Sample equity curve trending upward"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hero-eq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[36, 78, 120, 162].map((y) => (
          <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#hero-eq-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="520" cy="20" r="4" fill="var(--color-brand)" />
      </svg>
    </div>
  );
}

/* Inline line icons (Lucide-style, stroke = currentColor) so no emoji or icon font is needed. */
function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 3v18l2.5-1.5L9 21l3-1.5L15 21l2.5-1.5L20 21V3l-2.5 1.5L15 3l-3 1.5L9 3 6.5 4.5 4 3Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 3v18M13 8l1.5 1.5L17 7" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M7 21V10M12 21V4M17 21v-7" />
    </svg>
  );
}

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
