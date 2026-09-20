/**
 * Seeds a demo workspace with a term's worth of realistic trading.
 *
 * The point is a database someone can open the app against and immediately
 * see a dashboard that means something: a mix of instruments, a drawdown to
 * recover from, tagged mistakes that actually correlate with losses, and an
 * equity curve with shape. Numbers are generated from a fixed seed so the
 * demo looks the same for everyone and screenshots stay reproducible.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { computeTrade, tradingDayKey, type ExecutionInput } from '@bmz/core';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PasswordService } from '../src/modules/auth/password.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../../.env'), quiet: true });
loadEnv({ path: path.resolve(here, '../.env'), override: true, quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const DEMO_EMAIL = 'demo@bmztradelab.com';
const DEMO_PASSWORD = 'bmz-demo-password';
const TIMEZONE = 'America/New_York';

/**
 * A small deterministic PRNG. Math.random would make every seed run produce a
 * different demo, which makes a screenshot or a bug report unreproducible.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260920);

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function between(min: number, max: number, decimals = 2): number {
  return Number((min + random() * (max - min)).toFixed(decimals));
}

interface SymbolSpec {
  symbol: string;
  instrumentClass: 'STOCK' | 'FUTURES' | 'FOREX' | 'CRYPTO' | 'OPTION';
  price: number;
  /** Typical position size for this instrument. */
  size: [number, number];
  /** Typical move, as a fraction of price. */
  volatility: number;
  feePerUnit: number;
  precision: number;
}

const SYMBOLS: SymbolSpec[] = [
  {
    symbol: 'AAPL',
    instrumentClass: 'STOCK',
    price: 232,
    size: [50, 400],
    volatility: 0.012,
    feePerUnit: 0.005,
    precision: 2,
  },
  {
    symbol: 'NVDA',
    instrumentClass: 'STOCK',
    price: 178,
    size: [50, 300],
    volatility: 0.022,
    feePerUnit: 0.005,
    precision: 2,
  },
  {
    symbol: 'TSLA',
    instrumentClass: 'STOCK',
    price: 412,
    size: [25, 200],
    volatility: 0.028,
    feePerUnit: 0.005,
    precision: 2,
  },
  {
    symbol: 'SPY',
    instrumentClass: 'STOCK',
    price: 604,
    size: [50, 300],
    volatility: 0.008,
    feePerUnit: 0.005,
    precision: 2,
  },
  {
    symbol: 'MESZ5',
    instrumentClass: 'FUTURES',
    price: 6040,
    size: [1, 8],
    volatility: 0.006,
    feePerUnit: 1.24,
    precision: 2,
  },
  {
    symbol: 'MNQZ5',
    instrumentClass: 'FUTURES',
    price: 21800,
    size: [1, 5],
    volatility: 0.009,
    feePerUnit: 1.24,
    precision: 2,
  },
  {
    symbol: 'EURUSD',
    instrumentClass: 'FOREX',
    price: 1.0842,
    size: [10000, 100000],
    volatility: 0.004,
    feePerUnit: 0.00002,
    precision: 5,
  },
  {
    symbol: 'BTCUSD',
    instrumentClass: 'CRYPTO',
    price: 98400,
    size: [0.05, 0.6],
    volatility: 0.018,
    feePerUnit: 12,
    precision: 2,
  },
];

const SETUP_TAGS = ['Breakout', 'Pullback', 'Reversal', 'Range'];
const MISTAKE_TAGS = [
  'Chased the entry',
  'Moved the stop',
  'Oversized',
  'Exited early',
  'Revenge trade',
];
const EMOTION_TAGS = ['Calm', 'Anxious', 'Impatient', 'Confident'];

async function main(): Promise<void> {
  console.log('Seeding the BMZ Trade Lab demo workspace…');

  await resetDemoData();

  const passwords = new PasswordService();
  const passwordHash = await passwords.hash(DEMO_PASSWORD);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      displayName: 'Demo Trader',
      emailVerifiedAt: new Date(),
      timezone: TIMEZONE,
      locale: 'en',
      preferredCurrency: 'USD',
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: 'Demo workspace',
      slug: 'demo-workspace',
      ownerId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
      billingCustomer: { create: {} },
      entitlements: {
        createMany: {
          data: [
            { feature: 'accounts', limit: 5 },
            { feature: 'trades', limit: null },
            { feature: 'csv_import', limit: null },
            { feature: 'playbooks', limit: null },
            { feature: 'notebook', limit: null },
            { feature: 'reports', limit: null },
            { feature: 'attachment_megabytes', limit: 2048 },
            { feature: 'broker_sync', limit: 0 },
            { feature: 'replay', limit: 0 },
            { feature: 'ai_assistant', limit: 0 },
            { feature: 'mentorship', limit: 0 },
          ],
        },
      },
    },
  });

  const account = await prisma.account.create({
    data: {
      organizationId: organization.id,
      name: 'Main account',
      type: 'LIVE',
      broker: 'Demo Broker',
      currency: 'USD',
      startingBalance: new Prisma.Decimal(50000),
      timezone: TIMEZONE,
    },
  });

  const propAccount = await prisma.account.create({
    data: {
      organizationId: organization.id,
      name: 'Prop evaluation',
      type: 'PROP_EVALUATION',
      broker: 'Demo Prop',
      currency: 'USD',
      startingBalance: new Prisma.Decimal(150000),
      timezone: TIMEZONE,
    },
  });

  await prisma.instrument.createMany({
    data: SYMBOLS.map((spec) => ({
      organizationId: organization.id,
      symbol: spec.symbol,
      instrumentClass: spec.instrumentClass,
      currency: 'USD',
      pricePrecision: spec.precision,
    })),
  });

  const tags = await createTags(organization.id);
  const playbooks = await createPlaybooks(organization.id);
  await createProgressRules(organization.id);

  const tradeCount = await createTrades(
    organization.id,
    account.id,
    propAccount.id,
    tags,
    playbooks,
  );
  await createNotes(organization.id, user.id);
  await refreshTradingDays(organization.id);

  console.log(`
Done.

  Workspace   ${organization.name}
  Accounts    ${account.name}, ${propAccount.name}
  Trades      ${tradeCount}

  Sign in with
    email     ${DEMO_EMAIL}
    password  ${DEMO_PASSWORD}
`);
}

/** Clears any previous demo workspace so the seed is safe to re-run. */
async function resetDemoData(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, ownedOrgs: { select: { id: true } } },
  });

  if (!existing) return;

  // Everything else cascades from the organization and the user.
  for (const organization of existing.ownedOrgs) {
    await prisma.organization.delete({ where: { id: organization.id } });
  }
  await prisma.user.delete({ where: { id: existing.id } });
}

async function createTags(organizationId: string) {
  const palette: Record<string, string> = {
    Breakout: '#10b981',
    Pullback: '#14b8a6',
    Reversal: '#0ea5e9',
    Range: '#6366f1',
    'Chased the entry': '#f43f5e',
    'Moved the stop': '#f97316',
    Oversized: '#ef4444',
    'Exited early': '#eab308',
    'Revenge trade': '#dc2626',
    Calm: '#22c55e',
    Anxious: '#f59e0b',
    Impatient: '#fb7185',
    Confident: '#38bdf8',
  };

  await prisma.tag.createMany({
    data: [
      ...SETUP_TAGS.map((name) => ({
        organizationId,
        name,
        category: 'SETUP' as const,
        color: palette[name]!,
      })),
      ...MISTAKE_TAGS.map((name) => ({
        organizationId,
        name,
        category: 'MISTAKE' as const,
        color: palette[name]!,
      })),
      ...EMOTION_TAGS.map((name) => ({
        organizationId,
        name,
        category: 'EMOTION' as const,
        color: palette[name]!,
      })),
    ],
  });

  const rows = await prisma.tag.findMany({ where: { organizationId } });
  return new Map(rows.map((tag) => [tag.name, tag.id]));
}

async function createPlaybooks(organizationId: string) {
  const openingDrive = await prisma.playbook.create({
    data: {
      organizationId,
      name: 'Opening drive continuation',
      description:
        'Trade the first sustained move after the open when the overnight range breaks with volume behind it.',
      status: 'ACTIVE',
      color: '#10b981',
      ruleGroups: {
        create: [
          {
            name: 'Before entry',
            position: 0,
            rules: {
              create: [
                { text: 'Overnight range is broken on above-average volume', position: 0 },
                { text: 'Price is on the same side of VWAP as the trade', position: 1 },
                { text: 'A stop level exists within 1.5 times the average range', position: 2 },
              ],
            },
          },
          {
            name: 'Management',
            position: 1,
            rules: {
              create: [
                { text: 'Stop goes in with the entry, never after', position: 0 },
                { text: 'First target at 2R, remainder trails', position: 1 },
                { text: 'Flat before the close', position: 2, isRequired: false },
              ],
            },
          },
        ],
      },
    },
  });

  const meanReversion = await prisma.playbook.create({
    data: {
      organizationId,
      name: 'Range fade',
      description: 'Fade the extremes of an established range while the range holds.',
      status: 'ACTIVE',
      color: '#0ea5e9',
      ruleGroups: {
        create: [
          {
            name: 'Before entry',
            position: 0,
            rules: {
              create: [
                { text: 'The range has held for at least two hours', position: 0 },
                { text: 'No scheduled news inside the next 30 minutes', position: 1 },
                { text: 'Entry is within a quarter of the range of its edge', position: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  return [openingDrive.id, meanReversion.id];
}

async function createProgressRules(organizationId: string): Promise<void> {
  await prisma.progressRule.createMany({
    data: [
      {
        organizationId,
        phase: 'PREPARE',
        title: 'Review the overnight session and the economic calendar',
        position: 0,
      },
      { organizationId, phase: 'PREPARE', title: 'Mark the levels that matter today', position: 1 },
      {
        organizationId,
        phase: 'PREPARE',
        title: 'Write the plan: what I will trade and what I will skip',
        position: 2,
      },
      {
        organizationId,
        phase: 'TRADE',
        title: 'Every entry has a stop before it is placed',
        position: 0,
      },
      {
        organizationId,
        phase: 'TRADE',
        title: 'Risk per trade stays within my limit',
        position: 1,
      },
      { organizationId, phase: 'TRADE', title: 'No trade outside the plan', position: 2 },
      {
        organizationId,
        phase: 'REFLECT',
        title: 'Screenshot and tag every trade taken',
        position: 0,
      },
      { organizationId, phase: 'REFLECT', title: 'Write the end-of-day review', position: 1 },
      {
        organizationId,
        phase: 'REFLECT',
        title: 'Name one thing to do differently tomorrow',
        position: 2,
      },
    ],
  });
}

async function createTrades(
  organizationId: string,
  accountId: string,
  propAccountId: string,
  tags: Map<string, string>,
  playbooks: string[],
): Promise<number> {
  const today = new Date();
  let created = 0;

  for (let daysAgo = 120; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(today.getTime() - daysAgo * 86_400_000);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    // Some days are simply skipped, as they are in a real journal.
    if (random() < 0.22) continue;

    const tradesToday = 1 + Math.floor(random() * 4);

    for (let index = 0; index < tradesToday; index += 1) {
      const spec = pick(SYMBOLS);
      const useProp = spec.instrumentClass === 'FUTURES' && random() < 0.35;

      // A losing streak roughly 40 days back gives the equity curve a real
      // drawdown to recover from rather than a straight line up.
      const inSlump = daysAgo <= 55 && daysAgo >= 38;
      const winChance = inSlump ? 0.32 : 0.54;
      const isWin = random() < winChance;

      // A mistake is far more likely on a loser, so the tag breakdown shows a
      // relationship a trader could actually act on.
      const mistake = isWin
        ? random() < 0.08
          ? pick(MISTAKE_TAGS)
          : null
        : random() < 0.55
          ? pick(MISTAKE_TAGS)
          : null;

      const direction = random() < 0.62 ? 'BUY' : 'SELL';
      const entryHour = 9 + Math.floor(random() * 6);
      const entryMinute = Math.floor(random() * 60);

      const openedAt = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          entryHour + 4,
          entryMinute,
        ),
      );
      const holdMinutes = Math.round(4 + random() * 240);
      const closedAt = new Date(openedAt.getTime() + holdMinutes * 60_000);

      const entryPrice = Number(
        (spec.price * (1 + (random() - 0.5) * 0.05)).toFixed(spec.precision),
      );
      const quantity =
        between(spec.size[0], spec.size[1], spec.instrumentClass === 'CRYPTO' ? 3 : 0) ||
        spec.size[0];

      // The stop is placed first, and the exit is expressed in multiples of it,
      // which is how the R-multiples come out looking like a real distribution.
      const riskPerUnit = Number((entryPrice * spec.volatility).toFixed(spec.precision));
      const rMultiple = isWin ? between(0.4, 3.4, 2) : -between(0.3, 1.25, 2);
      const moveSign = direction === 'BUY' ? 1 : -1;

      const stopLoss = Number((entryPrice - moveSign * riskPerUnit).toFixed(spec.precision));
      const takeProfit = Number((entryPrice + moveSign * riskPerUnit * 2).toFixed(spec.precision));
      const exitPrice = Number(
        (entryPrice + moveSign * riskPerUnit * rMultiple).toFixed(spec.precision),
      );

      const feesPerSide = Number((quantity * spec.feePerUnit).toFixed(2));

      const executions: ExecutionInput[] = [
        {
          id: 'open',
          side: direction,
          quantity,
          price: entryPrice,
          fees: feesPerSide,
          executedAt: openedAt,
        },
        {
          id: 'close',
          side: direction === 'BUY' ? 'SELL' : 'BUY',
          quantity,
          price: exitPrice,
          fees: feesPerSide,
          executedAt: closedAt,
        },
      ];

      const computed = computeTrade(executions, {
        instrumentClass: spec.instrumentClass,
        symbol: spec.symbol,
        stopLoss,
        takeProfit,
      });

      const tagNames = [pick(SETUP_TAGS), pick(EMOTION_TAGS), ...(mistake ? [mistake] : [])];
      const tagIds = [...new Set(tagNames.map((name) => tags.get(name)!).filter(Boolean))];

      await prisma.trade.create({
        data: {
          organizationId,
          accountId: useProp ? propAccountId : accountId,
          symbol: spec.symbol,
          instrumentClass: spec.instrumentClass,
          direction: computed.direction,
          status: computed.status,
          openedAt: computed.openedAt,
          closedAt: computed.closedAt,
          durationMs: computed.durationMs === null ? null : BigInt(computed.durationMs),
          tradingDay: new Date(`${tradingDayKey(computed.openedAt, TIMEZONE)}T00:00:00.000Z`),
          multiplier: new Prisma.Decimal(computed.multiplier.toString()),
          peakQuantity: new Prisma.Decimal(computed.peakQuantity.toString()),
          openQuantity: new Prisma.Decimal(computed.openQuantity.toString()),
          closedQuantity: new Prisma.Decimal(computed.closedQuantity.toString()),
          averageEntryPrice: new Prisma.Decimal(computed.averageEntryPrice!.toString()),
          averageExitPrice: computed.averageExitPrice
            ? new Prisma.Decimal(computed.averageExitPrice.toString())
            : null,
          stopLoss: new Prisma.Decimal(stopLoss),
          takeProfit: new Prisma.Decimal(takeProfit),
          grossPnl: new Prisma.Decimal(computed.grossPnl.toString()),
          fees: new Prisma.Decimal(computed.fees.toString()),
          netPnl: new Prisma.Decimal(computed.netPnl.toString()),
          netReturn: computed.netReturn ? new Prisma.Decimal(computed.netReturn.toString()) : null,
          initialRisk: computed.initialRisk
            ? new Prisma.Decimal(computed.initialRisk.toString())
            : null,
          rMultiple: computed.rMultiple ? new Prisma.Decimal(computed.rMultiple.toString()) : null,
          plannedRewardRisk: computed.plannedRewardRisk
            ? new Prisma.Decimal(computed.plannedRewardRisk.toString())
            : null,
          reviewStatus: random() < 0.65 ? 'REVIEWED' : 'UNREVIEWED',
          reviewedAt: random() < 0.65 ? closedAt : null,
          rating: 1 + Math.floor(random() * 5),
          notes: noteFor(isWin, mistake),
          playbookId: random() < 0.7 ? pick(playbooks) : null,
          executions: {
            create: executions.map((execution) => ({
              organizationId,
              accountId: useProp ? propAccountId : accountId,
              side: execution.side,
              quantity: new Prisma.Decimal(String(execution.quantity)),
              price: new Prisma.Decimal(String(execution.price)),
              fees: new Prisma.Decimal(String(execution.fees ?? 0)),
              executedAt: execution.executedAt,
            })),
          },
          tags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } },
        },
      });

      created += 1;
    }
  }

  return created;
}

function noteFor(isWin: boolean, mistake: string | null): string {
  if (mistake === 'Chased the entry') {
    return 'Entry was late. The level came and went while I hesitated, and I took it anyway thirty cents worse. Wait for the retest next time.';
  }
  if (mistake === 'Moved the stop') {
    return 'Stop was where it should have been and I widened it. That is the one thing I said I would not do.';
  }
  if (mistake === 'Oversized') {
    return 'Size was above my limit because the setup looked obvious. It was not, and the loss was bigger than it needed to be.';
  }
  if (mistake === 'Exited early') {
    return 'Took it off at 1R out of nerves. The target filled twenty minutes later without coming near my stop.';
  }
  if (mistake === 'Revenge trade') {
    return 'Straight back in after the previous loss with no setup. This one is on tilt, not on the market.';
  }
  return isWin
    ? 'Plan worked. Entry at the level, stop under the structure, first target hit and the remainder trailed out.'
    : 'Setup was valid and it did not work. Stop was respected. Nothing to fix here.';
}

async function createNotes(organizationId: string, authorId: string): Promise<void> {
  const folder = await prisma.noteFolder.create({
    data: { organizationId, name: 'Weekly reviews', position: 0 },
  });

  await prisma.note.createMany({
    data: [
      {
        organizationId,
        authorId,
        folderId: folder.id,
        title: 'What the drawdown taught me',
        contentPlain:
          'Three weeks of losses, and the tag breakdown says almost all of it was "Chased the entry" and "Revenge trade". The setups were fine. The execution was not. Rule for next month: if I miss the level, the trade is gone.',
      },
      {
        organizationId,
        authorId,
        folderId: folder.id,
        title: 'Position sizing rules',
        contentPlain:
          'Risk 0.75% of the account per trade, 1.5% on an A+ setup, never more. Daily stop at three losers or 2% down, whichever comes first.',
      },
      {
        organizationId,
        authorId,
        title: 'Instruments I actually trade well',
        contentPlain:
          'MES and MNQ in the first two hours. AAPL and NVDA on clean daily levels only. EURUSD is not paying me — stop trading it until the numbers say otherwise.',
      },
    ],
  });
}

/** Fills the cached daily totals the calendar reads. */
async function refreshTradingDays(organizationId: string): Promise<void> {
  const grouped = await prisma.trade.groupBy({
    by: ['accountId', 'tradingDay'],
    where: { organizationId, deletedAt: null, tradingDay: { not: null } },
    _sum: { netPnl: true },
    _count: { _all: true },
  });

  for (const group of grouped) {
    if (!group.tradingDay) continue;

    const [wins, losses] = await Promise.all([
      prisma.trade.count({
        where: {
          organizationId,
          accountId: group.accountId,
          tradingDay: group.tradingDay,
          deletedAt: null,
          netPnl: { gt: 0 },
        },
      }),
      prisma.trade.count({
        where: {
          organizationId,
          accountId: group.accountId,
          tradingDay: group.tradingDay,
          deletedAt: null,
          netPnl: { lt: 0 },
        },
      }),
    ]);

    await prisma.tradingDay.upsert({
      where: {
        organizationId_accountId_date: {
          organizationId,
          accountId: group.accountId,
          date: group.tradingDay,
        },
      },
      create: {
        organizationId,
        accountId: group.accountId,
        date: group.tradingDay,
        netPnl: group._sum.netPnl ?? new Prisma.Decimal(0),
        tradeCount: group._count._all,
        winCount: wins,
        lossCount: losses,
      },
      update: {
        netPnl: group._sum.netPnl ?? new Prisma.Decimal(0),
        tradeCount: group._count._all,
        winCount: wins,
        lossCount: losses,
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
