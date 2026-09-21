import Link from 'next/link';
import { Wordmark } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * The marketing landing page.
 *
 * A two-column hero: the claim, the call to action and the toolset on the left;
 * an illustrative snapshot of the product — a results calendar with floating
 * cards — on the right. Everything is on-brand dark, and the figures are a
 * labelled example rather than anyone's real account. Feature pages, the
 * integration directory and pricing arrive with the marketing stage.
 */
export default function LandingPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div className="aurora pointer-events-none absolute inset-0 -z-10" />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Wordmark compactOnMobile />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-16">
        {/* Left: the pitch */}
        <div className="text-center lg:text-start">
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />
            Free while we build it with you
          </p>

          <h1 className="rise text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Trade with evidence, not memory.
          </h1>

          <p
            className="rise mx-auto mt-6 max-w-xl text-pretty text-base text-ink-muted sm:text-lg lg:mx-0"
            style={{ '--rise-delay': '80ms' } as React.CSSProperties}
          >
            BMZ Trade Lab records every fill, works out what each decision actually cost you, and
            reviews every session, so you spend your time on the next trade — not on a spreadsheet.
          </p>

          <div
            className="rise mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
            style={{ '--rise-delay': '140ms' } as React.CSSProperties}
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

          <ul
            className="rise mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-subtle lg:justify-start"
            style={{ '--rise-delay': '200ms' } as React.CSSProperties}
          >
            {['No card needed', 'Import any broker CSV', 'Your data stays yours'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>

          <div
            className="rise mt-10 lg:mt-12"
            style={{ '--rise-delay': '260ms' } as React.CSSProperties}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
              Everything in one place · 6 tools
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
              {TOOLS.map((tool, i) => (
                <span
                  key={tool}
                  className={
                    i === 0
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand'
                      : 'inline-flex items-center rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink'
                  }
                >
                  {i === 0 && <span className="size-1.5 rounded-full bg-brand" aria-hidden />}
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: the product snapshot */}
        <div className="rise lg:pl-6" style={{ '--rise-delay': '160ms' } as React.CSSProperties}>
          <ProductSnapshot />
        </div>
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

const TOOLS = [
  'Trade journal',
  'CSV import',
  'Day view',
  'Notebook',
  'Playbooks',
  'Reports',
  'Tags & filters',
  'Equity curve',
];

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
 * The hero's product snapshot: an app frame showing a month of results, with a
 * few cards floating over it on large screens. Sample data, labelled "Example".
 */
function ProductSnapshot() {
  return (
    <div className="relative mx-auto max-w-xl lg:max-w-none">
      {/* Main app frame */}
      <div className="card overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-loss/70" aria-hidden />
            <span className="size-2.5 rounded-full bg-warning/70" aria-hidden />
            <span className="size-2.5 rounded-full bg-profit/70" aria-hidden />
            <span className="ms-3 text-xs text-ink-subtle">Dashboard — June 2024</span>
          </div>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">
            Example
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-subtle">Net P&L</p>
              <p className="numeric mt-0.5 text-2xl font-semibold text-profit sm:text-3xl">
                +$16,240
              </p>
            </div>
            {/* Hidden at lg+, where the floating equity card sits over this corner. */}
            <div className="hidden gap-6 sm:flex lg:hidden">
              <MiniStat label="Win rate" value="58%" />
              <MiniStat label="Profit factor" value="1.9" tone="profit" />
            </div>
          </div>

          <MiniCalendar />
        </div>
      </div>

      {/* Floating cards — enhancement for wide screens only */}
      <div className="pointer-events-none absolute -right-4 -top-6 hidden w-56 lg:block xl:-right-10">
        <EquityCard />
      </div>
      <div className="pointer-events-none absolute -bottom-8 -left-6 hidden w-64 lg:block xl:-left-12">
        <ActivityCard />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'profit' }) {
  return (
    <div className="text-end">
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p
        className={`numeric mt-0.5 text-lg font-semibold ${tone === 'profit' ? 'text-profit' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}

type Cell = { d: number; disp?: string; tone?: 'profit' | 'loss'; lvl?: 1 | 2 | 3 } | null;

// A plausible, mostly-green example month laid out Mon–Sun. Two leading blanks
// put the 1st on the correct weekday; trailing blanks fill the final week.
const MONTH: Cell[] = [
  null,
  null,
  { d: 1 },
  { d: 2, disp: '+$1.1K', tone: 'profit', lvl: 2 },
  { d: 3, disp: '+$3.1K', tone: 'profit', lvl: 3 },
  { d: 4, disp: '+$1.0K', tone: 'profit', lvl: 2 },
  { d: 5, disp: '-$350', tone: 'loss', lvl: 1 },
  { d: 6, disp: '+$556', tone: 'profit', lvl: 1 },
  { d: 7 },
  { d: 8 },
  { d: 9, disp: '-$788', tone: 'loss', lvl: 2 },
  { d: 10, disp: '+$600', tone: 'profit', lvl: 1 },
  { d: 11, disp: '+$1.1K', tone: 'profit', lvl: 2 },
  { d: 12, disp: '-$350', tone: 'loss', lvl: 1 },
  { d: 13, disp: '+$875', tone: 'profit', lvl: 1 },
  { d: 14, disp: '+$608', tone: 'profit', lvl: 1 },
  { d: 15, disp: '+$1.2K', tone: 'profit', lvl: 2 },
  { d: 16, disp: '+$113', tone: 'profit', lvl: 1 },
  { d: 17 },
  { d: 18 },
  { d: 19, disp: '+$225', tone: 'profit', lvl: 1 },
  { d: 20, disp: '+$300', tone: 'profit', lvl: 1 },
  { d: 21, disp: '-$37', tone: 'loss', lvl: 1 },
  { d: 22, disp: '+$2.2K', tone: 'profit', lvl: 3 },
  { d: 23 },
  { d: 24, disp: '+$1.4K', tone: 'profit', lvl: 2 },
  { d: 25, disp: '-$210', tone: 'loss', lvl: 1 },
  { d: 26, disp: '+$980', tone: 'profit', lvl: 1 },
  { d: 27 },
  { d: 28, disp: '+$1.6K', tone: 'profit', lvl: 2 },
  { d: 29, disp: '+$430', tone: 'profit', lvl: 1 },
  { d: 30, disp: '+$770', tone: 'profit', lvl: 1 },
  null,
  null,
  null,
];

const LEVEL_MIX: Record<1 | 2 | 3, number> = { 1: 34, 2: 56, 3: 78 };

function MiniCalendar() {
  return (
    <div
      className="grid grid-cols-7 gap-1 sm:gap-1.5"
      role="grid"
      aria-label="Example results calendar"
    >
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
        <div key={w} className="pb-1 text-center text-[10px] font-medium text-ink-subtle">
          {w}
        </div>
      ))}

      {MONTH.map((cell, i) => {
        if (!cell) return <div key={`pad-${i}`} aria-hidden />;
        const bg = cell.tone
          ? `color-mix(in oklab, var(--color-chart-${cell.tone}) ${LEVEL_MIX[cell.lvl ?? 1]}%, var(--color-surface))`
          : undefined;
        return (
          <div
            key={cell.d}
            role="gridcell"
            className={`flex aspect-square flex-col justify-between rounded-md border p-1 ${
              cell.tone ? 'border-line-strong' : 'border-line/50'
            }`}
            style={{ backgroundColor: bg }}
          >
            <span className={`numeric text-[10px] ${cell.tone ? 'text-ink' : 'text-ink-subtle'}`}>
              {cell.d}
            </span>
            {cell.disp ? (
              <span className="numeric truncate text-[10px] font-semibold text-ink">
                {cell.disp}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EquityCard() {
  const line =
    'M0,70 C20,66 34,54 55,56 C76,58 88,40 110,38 C132,36 150,44 170,28 C190,12 205,18 220,6';
  const area = `${line} L220,84 L0,84 Z`;
  return (
    <div className="card p-4 shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-ink-subtle">Equity · 30 days</p>
        <span className="numeric text-xs font-semibold text-profit">+$16.2K</span>
      </div>
      <svg viewBox="0 0 220 84" className="mt-3 h-16 w-full" aria-hidden preserveAspectRatio="none">
        <defs>
          <linearGradient id="eq-card-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eq-card-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="220" cy="6" r="3.5" fill="var(--color-brand)" />
      </svg>
    </div>
  );
}

function ActivityCard() {
  const rows = [
    { icon: <SyncIcon />, title: 'Imported 7 trades from CSV', meta: '2s ago' },
    { icon: <LockIcon />, title: 'Review locked — June 12', meta: '2:54 PM' },
    { icon: <PlayIcon />, title: "Playbook 'Opening Drive' updated", meta: '1 day ago' },
  ];
  return (
    <div className="card divide-y divide-line p-1 shadow-2xl shadow-black/50">
      {rows.map((row) => (
        <div key={row.title} className="flex items-center gap-3 p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            {row.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink">{row.title}</p>
            <p className="text-[11px] text-ink-subtle">{row.meta}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Inline line icons (Lucide-style, stroke = currentColor) so no emoji or icon font is needed. */
function iconProps(size = 'size-5') {
  return {
    viewBox: '0 0 24 24',
    className: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function CheckIcon() {
  return (
    <svg {...iconProps('size-3.5 text-brand')}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 3v18l2.5-1.5L9 21l3-1.5L15 21l2.5-1.5L20 21V3l-2.5 1.5L15 3l-3 1.5L9 3 6.5 4.5 4 3Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 3v18M13 8l1.5 1.5L17 7" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 21h18" />
      <path d="M7 21V10M12 21V4M17 21v-7" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg {...iconProps('size-4')}>
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M21 8A9 9 0 0 0 5.6 5.6L3 8m0 8a9 9 0 0 0 15.4 2.4L21 16" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...iconProps('size-4')}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps('size-4')}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  );
}
