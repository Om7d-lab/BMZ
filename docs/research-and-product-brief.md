# BMZ Trade Lab — research and product brief

> Status: living document. Written at the start of stage one and updated as each
> stage lands. Everything here is a decision or an observation, not a wish list;
> anything still undecided says so.

---

## 1. What this product is

BMZ Trade Lab is a trading journal delivered as a hosted, multi-user web
application. A trader records what they actually did — every fill, with its
price, size, fees and timestamp — and the product works out what each decision
cost or earned, then shows them the patterns across hundreds of those decisions.

The one-line promise: **trade with evidence, not memory.**

The product is deliberately not a signal service, a broker, a chatroom, or a
backtest-only tool. It touches market data and broker connections, but only to
make the record of the trader's own behaviour more complete.

### Who it is for

| Segment                    | What they already do                                                 | What they need from us                                                                           |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Serious retail day traders | Screenshot trades, keep a spreadsheet that goes stale within a month | Import that does not require discipline, and statistics they would never compute by hand         |
| Prop-firm candidates       | Track an evaluation against a daily loss limit and a profit target   | Per-account rules, drawdown against a high-water mark, a daily view that makes the limit visible |
| Swing and position traders | Journal in a notes app, review quarterly                             | A notebook tied to the trades, and reports over months rather than sessions                      |
| Coaches and mentors        | Ask students to send screenshots                                     | Scoped, revocable read access to a student's journal and the ability to comment in place         |

The first three are the launch audience. Mentorship is designed for but not
built in the early stages.

### What "good" looks like

A trader who has used this for a quarter can answer, from the product and
without arguing with it:

- Which of my setups actually makes money, after fees?
- What is the real cost of the mistake I keep making?
- Which hour of the day, which instrument, and which position size am I worst at?
- Am I following my own rules, and has that changed?

If the product cannot answer those four questions, nothing else it does matters.

---

## 2. Market baseline

The journal category is well established. The researched baseline — what a
serious entrant is expected to have — is: automated and manual import,
configurable dashboards, a trade and day journal, a notebook, playbooks,
reports, replay and backtesting, AI assistance, progress rules, and broker or
prop-firm connectors. TradeZella's public product and help documentation is the
most complete published description of that baseline, and it is what the feature
inventory in this brief is measured against.

**Boundary, and it is not negotiable:** no TradeZella branding, copy,
screenshots, or exact UI layouts are reused anywhere in this product. The
baseline informs _what problems to solve_. It does not supply words, pictures,
or screen designs. Every string, colour and layout in BMZ Trade Lab is original.

### Where the category is weak, and where we compete

Three observations about the category shape what we build differently:

1. **Import is where journals die.** Most journals are abandoned within weeks
   because getting data in is manual work the trader has to remember to do. We
   treat CSV mapping, deduplication and rollback as a first-class subsystem with
   its own audit trail, not a settings-page afterthought.

2. **Most journals conflate result with execution.** A losing trade that
   followed the plan is a good trade. A winning trade that broke every rule is a
   problem. Our data model keeps execution rating and playbook adherence
   structurally separate from P&L, and our reports let a trader slice on both.

3. **The numbers are usually approximate.** Floating-point P&L, missing contract
   multipliers, and day boundaries drawn in the server's timezone all produce
   figures that quietly disagree with the broker statement. Once a trader
   catches one wrong number they stop trusting all of them. We treat arithmetic
   exactness as a product feature, not an implementation detail (see §5).

---

## 3. Feature inventory and staging

The full scope is far larger than one release. It is staged so each stage is
usable on its own.

### Stage 1 — Foundation and the manual journal _(delivered)_

- TypeScript monorepo: Next.js web app, NestJS API, PostgreSQL via Prisma,
  Docker Compose for Postgres, Redis, MinIO and a mail catcher, CI.
- The domain engine: FIFO execution matching, instrument-aware P&L,
  R-multiples, win rate, profit factor, expectancy, payoff ratio, streaks,
  equity curve and drawdown, timezone-correct trading days.
- Authentication: registration, sign-in, session rotation with replay
  detection, password reset, email verification, profile preferences.
- Workspaces, membership roles, and feature entitlements.
- Trading accounts across stocks, futures, forex, crypto and options.
- Manual trade and execution entry, trade list with filters, saved sort,
  cursor pagination, bulk edit and delete, trade detail with executions.
- Tags across setup, mistake, emotion and custom categories.
- Dashboard: headline statistics, equity curve, month calendar, recent trades.
- Report endpoints: grouped breakdowns by symbol, instrument class, direction,
  tag, playbook, day of week, hour of day and holding period.
- The dark design system, and the i18n foundation with RTL support.
- Seeded demo workspace with 120 trading days of realistic data.

### Stage 2 — Imports and journalling depth

CSV upload with column mapping and saved per-broker mappings; validation and
per-row error reporting; deduplication on the broker's own identifiers; import
history and one-click rollback; background processing on BullMQ. Day view with
plan and review, the calendar as a first-class screen, the rich notebook with
folders, templates and autosave, attachments on S3-compatible storage, soft
delete with a recovery bin, and revocable share links.

### Stage 3 — Playbooks, dashboards, reports

Playbooks with rule groups; per-trade rule adherence and its effect on
performance; the configurable dashboard widget system; the report builder and
expandable report templates; the progress tracker with Prepare / Trade /
Reflect rules, daily checklists, streaks, heatmaps and the locked end-of-day
review.

### Stage 4 — Localisation and marketing

The seven additional locales (Persian, Arabic, Spanish, Portuguese, Simplified
Chinese, Japanese, Turkish) with RTL for Persian and Arabic; the marketing site
with feature pages, an integration directory, a pricing-ready layout and legal
pages.

### Stage 5 — Advanced modules

Broker and prop-firm sync adapters with encrypted credentials, webhooks,
retries and account reconciliation; a historical-market-data provider
abstraction with candlestick charts, execution overlays, replay controls and
simulated backtesting kept separate from live results; the context-aware AI
assistant with scoped retrieval and explicit privacy boundaries; mentor and
mentee invitations with scoped, revocable, auditable access.

---

## 4. Product decisions, and why

These are the decisions a future contributor is most likely to want to reverse.
Each is recorded with its reason so the trade-off is visible before it is undone.

### Trades are derived, executions are the record

A trade is not a row a trader types a P&L into. It is the result of matching its
executions first in, first out. Every derived column — direction, status,
average prices, gross and net P&L, duration, R-multiple — is recomputed by the
domain engine on every write. There is no field anywhere in the API where a
trader can record a number that disagrees with their own fills.

Executions are append-only. Correcting a fill soft-deletes the old row and adds
a new one, so the record of what the broker originally reported survives the
correction. This is what makes the journal defensible when it disagrees with a
statement.

**Cost:** more write work per edit, and a heavier schema. **Reason:** a journal
whose numbers can be edited to taste is a diary, not a record.

### The trading day is drawn in the account's timezone

A position closed at 04:00 UTC belongs to the previous day in Chicago and to the
same day in Tehran. Every calendar, streak, daily total and date filter derives
its day from the account's IANA timezone, never from the server's locale. An
account's timezone cannot be changed once it has trades, because doing so would
silently move the trader's history onto different days. Stage two adds the
recalculation job that makes the change safe; until then it is refused with an
explanation rather than half-applied.

### Execution rating is separate from result

A trade carries a 1–5 execution rating and, later, playbook adherence. Neither
is derived from P&L, and the UI says so in as many words. This is the single
most important modelling decision in the product: it is what lets a trader
distinguish a good decision with a bad outcome from a bad decision that got
lucky, which is the entire point of reviewing trades.

### Entitlements, not plan names

Nothing in the codebase branches on `plan === 'free'`. Code asks whether the
workspace is entitled to a feature, and rows in the `entitlements` table decide.
Launching a paid tier later is a data change, not a hunt through conditionals.
Billing is abstracted behind a `BillingCustomer` record whose provider is
`"none"`; nobody is charged, and attaching Stripe needs no schema change.

### Free at launch, generously

The launch plan allows 5 trading accounts, unlimited trades, unlimited CSV
imports, playbooks, notebook and reports, and 2 GB of attachments. Broker sync,
replay, the AI assistant and mentorship are entitled at zero because they are
not built yet — the entitlement list doubles as an honest roadmap the trader can
read in settings.

### Open questions

- **Pricing.** Deferred until there is usage to price against. The entitlement
  system means this can be decided late without rework.
- **Mobile.** Responsive web only for now; the layouts are built to phone width
  and verified at 390 px. A native app is not planned.
- **Team workspaces.** The schema supports several members per workspace with
  roles, but no invitation UI exists yet. Whether prop desks actually want this,
  or whether mentorship covers the need, is unresolved.

---

## 5. What we are strict about

### Decimal arithmetic, end to end

No money, price or quantity is ever a JavaScript `Number` in this system.

- In the domain engine: `Decimal` from decimal.js at 28 significant digits.
- In the database: `NUMERIC` columns sized per role — `(28,10)` for prices and
  quantities, `(20,6)` for money, `(16,6)` for ratios.
- Over the wire: **strings**, not JSON numbers, because a JSON number is a
  float and a float cannot hold an eight-decimal crypto quantity or survive
  `0.1 + 0.2`.
- In the browser: converted to `Number` only at the moment a figure is handed to
  `Intl.NumberFormat` for display, never before arithmetic.

### Contract multipliers

A futures or options position moves by `priceChange × multiplier` per contract.
Getting it wrong scales every downstream number silently. The engine resolves
the multiplier from, in order: an explicit override on the trade, the
workspace's instrument record, a table of the futures contracts a retail trader
actually trades, and finally the asset-class default (100 for equity options, 1
otherwise).

### Ratios that cannot lie

Every ratio in the engine routes through a division that returns `null` rather
than `Infinity` or `NaN`. A trader with no losing trades yet sees "—" for profit
factor, not "∞". The win rate's denominator is decisive trades only;
break-even trades are counted and reported, but they neither inflate nor deflate
the rate.

### Tenancy

Every row a trader can see hangs off an `organizationId`. A single guard
resolves the workspace from a header and proves membership before any handler
runs; services receive an id they can trust. A cross-tenant identifier returns
404, and a forced workspace header returns 403 — neither distinguishes "does not
exist" from "not yours", so the API cannot be used to probe for valid ids.

### Accessibility and colour

Green and red are what a trader expects for profit and loss, and they are also
the classic red-green colour-blindness trap. Measured with the dataviz
validator, the product's profit and loss text tokens sit 5.0 ΔE apart under
deuteranopia — not enough. Chart marks therefore use a pair separated by
lightness as well as hue, measured at 20.8 ΔE, and every mark drawn in those
colours also carries its signed number. Colour is reinforcement in this product;
it is never the only channel a value is available through.

---

## 6. What we will not do

- Reuse any competitor's branding, copy, screenshots or exact layouts.
- Give trading advice, or present any statistic as a prediction.
- Activate a third-party integration without its own credentials and contract.
  Broker sync, market data, email, storage, billing and AI are each configured
  through environment variables and are inert until supplied.
- Send a trader's journal data to an AI model without an explicit, scoped,
  auditable grant. The `AssistantConversation` record stores exactly what was in
  scope for each conversation so a trader can audit it after the fact.
- Charge anybody while the product is described as free.

---

## 7. How success is measured

| Question                      | Signal                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Does import work?             | Share of new workspaces with more than 20 trades within 7 days                              |
| Does the journal stick?       | Share of workspaces still recording trades in week 4                                        |
| Is the review loop real?      | Share of closed trades that reach `REVIEWED`                                                |
| Do the numbers get trusted?   | Support reports of a figure disagreeing with a broker statement, which should trend to zero |
| Is it usable outside English? | Locale coverage, and RTL sessions as a share of the total, once stage four ships            |

---

## 8. Sources

The market baseline draws on TradeZella's public product site and help
documentation — its getting-started guide, dashboard widget reference, journal
workflow, notebook, playbooks, replay and backtesting, and mentor modes — as the
most complete published description of what the category offers.

- <https://www.tradezella.com/>
- <https://help.tradezella.com/en/articles/13863136-getting-started-with-tradezella>
- <https://help.tradezella.com/en/articles/7118437-understanding-dashboard-widgets-and-stats>

These are read as a description of the problem space. No text, image or layout
from them appears in this product.
