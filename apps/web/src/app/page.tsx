import Link from 'next/link';

/**
 * The marketing landing page.
 *
 * Deliberately short at this stage: it establishes the brand and the one claim
 * the product makes, and gets out of the way. Feature pages, the integration
 * directory and pricing arrive with the marketing stage.
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
            className="rounded-lg px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
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

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-20 text-center sm:pt-28">
        <p className="mb-5 inline-flex items-center rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          Free while we build it with you
        </p>

        <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
          Trade with evidence, not memory.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-ink-muted sm:text-lg">
          BMZ Trade Lab records every fill, works out what each decision actually cost you, and
          shows you the patterns you would never spot by scrolling back through a broker statement.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong sm:w-auto"
          >
            Create your journal
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-line bg-surface px-6 py-3 text-sm text-ink transition-colors hover:bg-surface-raised sm:w-auto"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-subtle">
          Stocks, futures, forex, crypto and options. No card needed.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        <Feature
          title="Every fill, not every guess"
          body="Enter trades by hand or import a broker CSV. P&L, R-multiples and holding periods are worked out from the executions, so the numbers are the broker's, not yours."
        />
        <Feature
          title="The review you keep skipping"
          body="A day view, a notebook and playbook rules that get checked against the trade you actually took. Lock the end-of-day review and the streak starts meaning something."
        />
        <Feature
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 text-start">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${small ? 'text-sm' : 'text-base'}`}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-brand font-bold text-canvas"
      >
        B
      </span>
      <span className="font-semibold tracking-tight text-ink">BMZ Trade Lab</span>
    </span>
  );
}
