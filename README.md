# BMZ Trade Lab

A trading journal for people who want to know, rather than remember, how they
trade. Record every fill; the product works out what each decision cost or
earned and shows the pattern across hundreds of them.

**Trade with evidence, not memory.**

> Status: stage one. The foundation and the manual journal are built and
> running. See [`docs/research-and-product-brief.md`](docs/research-and-product-brief.md)
> for the staging plan and the decisions behind it.

---

## What works today

- **Auth and workspaces** — registration, sign-in on httpOnly cookies, refresh
  rotation with replay detection, membership roles, feature entitlements.
- **Trading accounts** across stocks, futures, forex, crypto and options, each
  with its own currency and IANA timezone.
- **Trades derived from executions.** You record fills; FIFO matching produces
  direction, status, average prices, gross and net P&L, duration and R-multiple.
  There is no field anywhere that lets a number disagree with the fills behind it.
- **Trade list** with filters, search, sorting, cursor pagination, bulk edit and
  delete, and a detail view showing every execution.
- **Analytics** — win rate, profit factor, expectancy, payoff ratio, streaks,
  equity curve, drawdown against a high-water mark, and breakdowns by symbol,
  instrument class, direction, tag, day of week, hour of day and holding period.
- **Dashboard** with an equity curve and a month calendar, both hand-drawn SVG.
- **Seeded demo workspace** — 120 trading days of plausible data, including a
  losing stretch, so every screen has something real on it.

Imports, the notebook, playbooks, the report builder, the progress tracker,
localisation beyond English, broker sync, replay and the assistant are staged
for later releases and described in the brief.

## Getting started

Requires Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env          # the defaults match docker-compose
pnpm infra:up                 # postgres, redis, minio, mailpit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev                      # api on :4000, web on :3000
```

Then sign in at <http://localhost:3000> with the seeded account:

```
demo@bmztradelab.com
bmz-demo-password
```

API documentation is served at <http://localhost:4000/api/docs>, generated from
the same Zod schemas that validate the requests.

### Without Docker

If a Docker daemon is not available, point `DATABASE_URL` and `REDIS_URL` at
your own Postgres 16 and Redis. Nothing else in the stack assumes containers.

## Layout

```
apps/
  api/              NestJS 12 (ESM), Prisma 7, PostgreSQL
  web/              Next.js 16 App Router, React 19, Tailwind 4
packages/
  core/             the domain engine — matching, P&L, metrics, trading days
  contracts/        Zod schemas shared by the API and the web app
  i18n/             locale negotiation, message catalogues, formatters
docs/
  research-and-product-brief.md
  master-implementation-prompt.md
```

`packages/core` has no dependency on Nest, Next, Prisma or HTTP. It takes
executions and returns numbers, which is why it is the part with the most tests.

## Commands

| Command                                       | What it does                        |
| --------------------------------------------- | ----------------------------------- |
| `pnpm dev`                                    | API and web together, both watching |
| `pnpm build`                                  | packages, then API, then web        |
| `pnpm test`                                   | every workspace                     |
| `pnpm lint` / `pnpm format`                   | ESLint / Prettier                   |
| `pnpm typecheck`                              | `tsc --noEmit` everywhere           |
| `pnpm db:migrate` / `db:seed` / `db:reset`    | schema and demo data                |
| `pnpm infra:up` / `infra:down` / `infra:nuke` | local services                      |

## Things worth knowing before you change anything

- **No money, price or quantity is ever a JavaScript `Number`.** Decimal.js in
  the engine, `NUMERIC` in Postgres, **strings** over the wire. A JSON number is
  a float, and a float cannot hold an eight-decimal crypto quantity.
- **The trading day is drawn in the account's timezone**, never the server's. A
  position closed at 04:00 UTC belongs to the previous day in Chicago.
- **Every row hangs off an `organizationId`,** and a single guard proves
  membership before any handler runs. Cross-tenant ids return 404, not 403, so
  the API cannot be used to probe for valid ones.
- **Execution quality is stored separately from P&L.** A losing trade that
  followed the plan is a good trade; the schema is built so reports can say so.

[`docs/master-implementation-prompt.md`](docs/master-implementation-prompt.md)
is the full brief for continuing this work, including the recipe for adding an
API module and the design-system rules.

## Originality

The journal category's feature baseline informed what problems this product
solves. No branding, copy, screenshot or screen layout from any other product
is reused here. Every string, colour and layout is original.

## Licence

Unlicensed and private.
