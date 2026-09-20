import type { Execution as ApiExecution, Trade as ApiTrade } from '@bmz/contracts';
import { toApi, toApiRequired } from '../../common/decimal.js';
import type { Execution, Prisma } from '../../generated/prisma/client.js';

/** The exact include shape every trade read uses, so mapping is total. */
export const tradeInclude = {
  account: { select: { name: true } },
  executions: {
    where: { deletedAt: null },
    orderBy: { executedAt: 'asc' },
  },
  tags: { include: { tag: true } },
  _count: { select: { attachments: true } },
} as const satisfies Prisma.TradeInclude;

export type TradeWithRelations = Prisma.TradeGetPayload<{ include: typeof tradeInclude }>;

export function toApiExecution(execution: Execution): ApiExecution {
  return {
    id: execution.id,
    side: execution.side,
    quantity: toApiRequired(execution.quantity),
    price: toApiRequired(execution.price),
    fees: toApiRequired(execution.fees),
    executedAt: execution.executedAt.toISOString(),
    orderId: execution.orderId,
    externalId: execution.externalId,
  };
}

export function toApiTrade(
  trade: TradeWithRelations,
  options: { includeExecutions?: boolean } = {},
): ApiTrade {
  return {
    id: trade.id,
    accountId: trade.accountId,
    accountName: trade.account.name,
    symbol: trade.symbol,
    instrumentClass: trade.instrumentClass,
    direction: trade.direction,
    status: trade.status,

    openedAt: trade.openedAt.toISOString(),
    closedAt: trade.closedAt?.toISOString() ?? null,
    // BigInt does not survive JSON, and a holding period never exceeds the
    // safe integer range in milliseconds.
    durationMs: trade.durationMs === null ? null : Number(trade.durationMs),
    tradingDay: trade.tradingDay ? trade.tradingDay.toISOString().slice(0, 10) : null,

    multiplier: toApiRequired(trade.multiplier),
    peakQuantity: toApiRequired(trade.peakQuantity),
    openQuantity: toApiRequired(trade.openQuantity),
    closedQuantity: toApiRequired(trade.closedQuantity),
    averageEntryPrice: toApi(trade.averageEntryPrice),
    averageExitPrice: toApi(trade.averageExitPrice),

    stopLoss: toApi(trade.stopLoss),
    takeProfit: toApi(trade.takeProfit),

    grossPnl: toApiRequired(trade.grossPnl),
    fees: toApiRequired(trade.fees),
    netPnl: toApiRequired(trade.netPnl),
    netReturn: toApi(trade.netReturn),
    initialRisk: toApi(trade.initialRisk),
    rMultiple: toApi(trade.rMultiple),
    plannedRewardRisk: toApi(trade.plannedRewardRisk),

    reviewStatus: trade.reviewStatus,
    rating: trade.rating,
    notes: trade.notes,
    playbookId: trade.playbookId,
    tags: trade.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
    })),
    ...(options.includeExecutions !== false
      ? { executions: trade.executions.map(toApiExecution) }
      : {}),
    attachmentCount: trade._count.attachments,

    createdAt: trade.createdAt.toISOString(),
    updatedAt: trade.updatedAt.toISOString(),
  };
}
