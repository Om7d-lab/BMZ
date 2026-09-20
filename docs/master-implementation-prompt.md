# BMZ Trade Lab — master implementation prompt

This document is a reusable brief. Hand it, whole or in part, to an engineer or
an AI agent picking up any stage of BMZ Trade Lab, and they should be able to
build in the same direction as what already exists without asking what the
conventions are.

It is written as instructions to the implementer. Where it says "must", the
existing code already works that way and breaking it will break something else.

---

## 0. The one-paragraph version

Build BMZ Trade Lab: an original, premium dark trading-journal SaaS, English
first with Persian, Arabic, Spanish, Portuguese, Simplified Chinese, Japanese
and Turkish support including right-to-left. TypeScript monorepo — Next.js web
app, NestJS API, PostgreSQL with Prisma, Redis with BullMQ, S3-compatible
storage, Docker Compose, CI. A trade is derived from its executions, never
typed in. Money is exact decimal everywhere and a string on the wire. Every row
is scoped to a workspace. Do not reuse any competitor's branding, copy,
screenshots or layouts.

---

## 1. Repository shape

```
bmz-trade-lab/
├── apps/
│   ├── api/                  @bmz/api      NestJS 12, ESM, REST + OpenAPI
│   │   ├── prisma/
│   │   │   ├── schema.prisma               the whole data model
│   │   │   ├── migrations/                 committed, never edited in place
│   │   │   └── seed.ts                     deterministic demo workspace
│   │   ├── prisma.config.ts                Prisma 7 config; owns DATABASE_URL
│   │   └── src/
│   │       ├── common/                     guards, filters, pipes, decorators
│   │       ├── config/                     env schema, validated at boot
│   │       ├── generated/prisma/           generated client (gitignored)
│   │       ├── modules/                    one directory per bounded concern
│   │       └── main.ts
│   └── web/                  @bmz/web      Next.js 16 App Router, Tailwind 4
│       └── src/
│           ├── app/                        routes; (auth) and (app) groups
│           ├── components/                 ui, charts, layout, and per-feature
│           ├── lib/                        api client, formatting
│           └── proxy.ts                    route protection (Next 16 naming)
├── packages/
│   ├── core/                 @bmz/core     the domain engine. No I/O at all.
│   ├── contracts/            @bmz/contracts Zod schemas shared by API and web
│   └── i18n/                 @bmz/i18n     locales, direction, formatters
├── docs/
├── docker-compose.yml                      postgres, redis, minio, mailpit
├── .env.example                            every variable, commented
└── .github/workflows/ci.yml
```

**Dependency direction is one way.** `packages/*` never import from `apps/*`.
`@bmz/core` imports nothing from the workspace at all — it is pure arithmetic
with no database, no HTTP and no framework, which is what makes it testable
without a fixture.

### Getting it running

```bash
pnpm install
cp .env.example .env            # then set the two JWT secrets
pnpm infra:up                   # postgres, redis, minio, mailpit
pnpm db:migrate                 # applies migrations
pnpm db:seed                    # demo workspace, 120 trading days
pnpm dev                        # api on :4000, web on :3000
```

Sign in as `demo@bmztradelab.com` / `bmz-demo-password`.

---

## 2. Non-negotiables

Break any of these and something downstream is silently wrong.

### 2.1 Money is never a float

- `@bmz/core` does all arithmetic on `Decimal` (decimal.js, 28 significant
  digits). It exports `Decimal` with an explicit constructor interface, because
  decimal.js's ESM entry and its type declarations disagree; import it from
  `@bmz/core`, never from `decimal.js` directly.
- Postgres columns: prices and quantities `NUMERIC(28,10)`, money
  `NUMERIC(20,6)`, ratios `NUMERIC(16,6)`.
- **The API transports every decimal as a string.** A JSON number is a float.
  `decimalString` in `@bmz/contracts` is the validator; `common/decimal.ts` in
  the API is the only place Prisma `Decimal`, domain `Decimal` and wire strings
  convert between each other.
- The web app calls `Number()` on a decimal string only when handing it to
  `Intl.NumberFormat`. Never before arithmetic. There should be no arithmetic in
  the web app at all.

### 2.2 A trade is derived from its executions

`computeTrade(executions, options)` in `@bmz/core` is the only place a trade's
numbers come from. It matches fills first in, first out and returns direction,
status, peak and open quantity, average entry and exit, gross and net P&L,
fees, net return, initial risk, R-multiple, planned reward:risk, duration, and
a reversal count.

Every trade write calls it and persists the result. No endpoint accepts a
client-supplied P&L, average price or R-multiple. If you are adding a write
path, it goes through `TradesService.computedColumns`.

Executions are append-only. Replacing a trade's fills soft-deletes the old rows
and inserts new ones, inside one transaction.

### 2.3 The trading day belongs to the account's timezone

`tradingDayKey(instant, timeZone)` in `@bmz/core` is the only way a calendar day
is derived. Never `toISOString().slice(0, 10)` on a raw instant, and never the
server's locale. The account's `timezone` column is authoritative; the user's is
the default for new accounts.

`TradingDay` rows cache each day's totals so the calendar is one query; they are
refreshed inside the same transaction as any write that invalidates them.

### 2.4 Every query is workspace-scoped

`TenantGuard` runs globally. It resolves the workspace from the
`x-bmz-organization` header (falling back to the caller's first workspace),
proves membership, checks any `@Roles(...)` requirement, and attaches an
`organizationId` the services can trust.

- Read it with the `@Tenant()` parameter decorator, which **throws** if the
  guard did not run. A controller cannot accidentally query with `undefined`.
- Routes about the person rather than a workspace carry `@NoTenant()`. Public
  routes carry `@Public()`. Both are opt-outs: the default is protected.
- A resource belonging to another workspace returns **404**, not 403. A forced
  workspace header returns **403**. Neither response distinguishes "not found"
  from "not yours".

### 2.5 Originality

No competitor branding, copy, screenshots or exact layouts. Write your own
strings. If a sentence in the UI could be pasted from another product's help
centre, rewrite it.

---

## 3. The domain engine (`@bmz/core`)

Pure functions, no I/O, exhaustively unit-tested. Add to it before adding
arithmetic anywhere else.

| Module        | Exports                                                                                                    | Notes                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `money`       | `Decimal`, `dec`, `sum`, `safeDivide`, `roundMoney`, `currencyDecimals`                                    | `safeDivide` returns `null` rather than `Infinity` — every ratio goes through it        |
| `instruments` | `resolveMultiplier`, `futuresRoot`, `defaultPricePrecision`                                                | Multiplier order: explicit override → instrument record → futures table → class default |
| `trade`       | `computeTrade`                                                                                             | FIFO matching; handles scale-ins, partial exits and reversals through flat              |
| `metrics`     | `summarizePerformance`, `computeStreaks`, `classifyOutcome`                                                | Closed trades only; break-even excluded from the win-rate denominator                   |
| `equity`      | `buildEquityCurve`, `returnStandardDeviation`                                                              | Drawdown against the running high-water mark, not the starting balance                  |
| `tradingDay`  | `tradingDayKey`, `startOfTradingDay`, `endOfTradingDay`, `addDays`, `tradingDayRange`, `groupByTradingDay` | DST-safe; tested across spring-forward                                                  |

**Rules for changing it:** a new statistic gets a function here and a test
alongside it before any controller or component references it. A function that
can divide by zero returns `null`. A function that can receive a degenerate
range returns something finite.

---

## 4. The API (`@bmz/api`)

NestJS 12, which is **ESM-only** — the package is `"type": "module"`, tsconfig
is `NodeNext`, and every relative import carries an explicit `.js` extension.

### Conventions

- **Validation** is Zod, from `@bmz/contracts`, applied with
  `@Body(zodBody(schema))`. The same schema generates the OpenAPI document via
  `ApiZodBody` / `ApiZodResponse`, so validation and documentation cannot drift.
- **Errors** all pass through `AllExceptionsFilter` and come out in the one
  shape `@bmz/contracts` describes. Prisma errors are translated there: `P2002`
  → 409, `P2025` → 404, `P2003` → 400. Driver messages never reach a client.
- **Prisma 7** takes its URL from `prisma.config.ts` and connects through
  `PrismaPg`. The client generates into `src/generated/prisma` as ESM and is
  gitignored; CI runs `pnpm db:generate`.
- **Routes** live under `/api/v1`. Versioning is URI-based.
- **Auth** is an access JWT plus an opaque refresh token, both in `httpOnly`
  cookies. Refresh tokens are stored only as a SHA-256 hash and rotate on use;
  presenting a rotated token revokes the whole family, because that replay is
  the signature of a stolen token.
- **Passwords** use scrypt from `node:crypto` behind `PasswordService`, in a
  versioned `scrypt$N$r$p$salt$hash` format, with `needsRehash` and transparent
  upgrade on sign-in. Moving to argon2id later needs one branch in `verify`, and
  no password resets.

### Adding a module

1. Contracts first: request and response schemas in `packages/contracts/src`.
2. A service taking `organizationId` as its first argument, always.
3. A controller using `@Tenant()`, `@Roles()` where writes need a role, and the
   OpenAPI decorators.
4. Register it in `app.module.ts`.
5. Unit-test the logic that is not a database call; put anything arithmetic in
   `@bmz/core` and test it there instead.

---

## 5. The web app (`@bmz/web`)

Next.js 16 App Router. Server components fetch through `serverApi`, which
forwards the incoming cookies; client components fetch through `apiRequest`
with `credentials: 'include'`.

`src/proxy.ts` (Next 16's renaming of middleware) redirects on the _presence_
of a session cookie. It is routing convenience, not security — the API makes
every real authorisation decision. `app/(app)/layout.tsx` is where an expired
session is actually caught.

### Design system

Tokens are CSS custom properties in `app/globals.css` under `@theme`, consumed
as Tailwind utilities. Do not introduce a hex value in a component; add a token.

| Group           | Tokens                                                   |
| --------------- | -------------------------------------------------------- |
| Surfaces        | `canvas`, `surface`, `surface-raised`, `surface-overlay` |
| Lines           | `line`, `line-strong`                                    |
| Ink             | `ink`, `ink-muted`, `ink-subtle`                         |
| Brand           | `brand`, `brand-strong`, `brand-soft`, `accent`          |
| P&L text        | `profit`, `profit-soft`, `loss`, `loss-soft`, `warning`  |
| P&L chart marks | `chart-profit`, `chart-loss`                             |

The base is a cool graphite-navy rather than neutral grey, because a trader
looks at this for hours and a slight blue cast reads as calmer under low light.
Emerald and rose are the only strongly saturated colours in the system, so a
number in colour always means money.

**Why there are two P&L pairs.** The text tokens are tuned for contrast against
the surface. Measured with the dataviz validator they sit only 5.0 ΔE apart
under deuteranopia — fine for text that always carries a sign, not fine for a
filled mark. The chart pair separates the poles by lightness as well as hue,
measured at 20.8 ΔE. Use `chart-profit` / `chart-loss` for any fill; use
`profit` / `loss` for text. Either way the value is also printed with its sign,
so colour is never the only channel.

### Rules

- Numbers wear `.numeric` — the mono face with tabular figures. A column of
  figures that is not tabular is unscannable.
- Money is always signed when it is a result (`formatSignedCurrency`), never
  signed when it is a magnitude.
- Use logical properties — `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`,
  `text-end` — never `ml-*`/`text-left`. Setting `dir="rtl"` on `<html>` must
  mirror the whole interface with no component changes.
- List views get a real `<table>` with `<th scope>`, so they are navigable by
  screen reader and sortable by header.
- Every empty state uses `EmptyState`; no screen invents its own.
- Filter state lives in the URL, not in component state, so a filtered view is a
  link that survives a refresh.
- Width passed via `className` to `Input`/`Select` loses to their built-in
  `w-full` (Tailwind resolves conflicting utilities by stylesheet order, not
  class order). Wrap the control in a sized element instead.

### Charts

Hand-written inline SVG, no charting dependency. Geometry lives in
`components/charts/geometry.ts` and is unit-tested separately from rendering.

- One series means no legend; the card heading names the line.
- Never a dual-axis chart.
- Long series are downsampled before drawing — a year of trades is more points
  than the chart has pixels.
- Line charts carry a crosshair and tooltip; heatmap cells carry their value.
- Axes and grid are recessive; the data is the subject.

---

## 6. Data model notes

The full schema is `apps/api/prisma/schema.prisma`, commented throughout. What a
new contributor most needs to know:

- **Soft delete** is `deletedAt` on `User`, `Organization`, `Account`,
  `Instrument`-adjacent records, `Trade`, `Execution`, `Note`, `Playbook` and
  `Attachment`. Every query filters `deletedAt: null`. A trader's history is
  never hard-deleted by an ordinary action.
- **`ImportBatch`** is the unit of rollback: every trade and execution an import
  created points back to it, so a bad import is undone by deleting its batch.
- **`Entitlement`** rows gate features. `limit` is a 32-bit integer, so a
  storage quota is counted in megabytes, not bytes.
- **`AuditLog`** is append-only and is written for imports, rollbacks,
  permission changes, share links and broker connections.
- **Boundary tables** — `BrokerConnection`, `SyncRun`, `MentorLink`,
  `MentorComment`, `AssistantConversation`, `AssistantMessage` — exist before
  the features do, because retrofitting tenancy and audit trails onto live data
  is far more expensive than carrying a few unused tables.
- Migrations are committed and never edited after they have been applied
  anywhere. Change the schema and generate a new one.

---

## 7. Localisation

`@bmz/i18n` owns the locale registry: `en`, `fa`, `ar`, `es`, `pt`, `zh-CN`,
`ja`, `tr`, with direction, native name and BCP-47 tag for each. Persian and
Arabic are right-to-left.

- The English catalogue is the contract. Other locales are typed
  `Partial<Messages>` and fall back **per key**, so a partly translated locale
  degrades one string at a time rather than one page at a time.
- Direction lives in the shared package, not the web app, because the API needs
  it too for server-rendered exports and email.
- `negotiateLocale` handles an `Accept-Language` header with quality weighting
  and regional fallback (`pt-PT` → `pt`).
- Numbers and the P&L sign stay left-to-right inside RTL text: `-1,240.50` reads
  the same way in Persian as in English. The `.numeric` class handles this.

---

## 8. Testing and CI

- **`@bmz/core` is where the arithmetic is tested**, exhaustively, with no
  fixtures: FIFO matching, scale-ins, partial exits, reversals, futures
  multipliers, options multipliers, crypto precision, R-multiples with and
  without a stop, fee treatment, streaks, drawdown, timezone boundaries across a
  DST transition.
- API unit tests cover the pieces that are not database calls: password hashing
  and its malformed-input paths, duration parsing, query normalisation.
- Web tests cover the pure helpers: formatting, tone selection, query-string
  building, chart geometry.
- CI runs, in order: install, generate the Prisma client, check formatting,
  lint, typecheck, apply migrations, test, build. Postgres and Redis run as
  service containers.

Write the test with the behaviour, not after it. A test that only asserts the
happy path is not finished — the interesting cases here are zero denominators,
empty sets, degenerate ranges and DST.

---

## 9. When the plan runs out

Where this document and the code disagree, the code wins and this document is
wrong; fix it. Where a detail is genuinely unspecified, pick the reasonable
default, write down which you picked and why in a comment at the decision point,
and keep going. A stalled stage helps nobody, and a decision recorded in a
comment can be reversed cheaply — an undocumented one cannot.

Two questions are worth asking before adding anything:

1. **Can a trader act on this?** A statistic nobody changes their behaviour over
   is clutter.
2. **Would this survive a disagreement with a broker statement?** If the answer
   is "probably", the arithmetic needs another look.
