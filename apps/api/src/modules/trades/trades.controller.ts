import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  bulkDeleteTradesRequest,
  bulkUpdateTradesRequest,
  createTradeRequest,
  listTradesQuery,
  paginated,
  trade as tradeSchema,
  updateTradeRequest,
  type Paginated,
  type Trade,
} from '@bmz/contracts';
import { TradesService } from './trades.service.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { Tenant } from '../../common/decorators/tenant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiStandardErrors, ApiZodBody, ApiZodResponse } from '../../common/swagger/zod-openapi.js';

@ApiTags('trades')
@ApiStandardErrors({ status: 404, description: 'No such trade in this workspace' })
@Controller('trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  @ApiOperation({ summary: 'List trades, filtered and cursor-paginated' })
  @ApiZodResponse(200, paginated(tradeSchema))
  async list(
    @Tenant() organizationId: string,
    // Query strings arrive as strings and repeated keys as arrays; the schema
    // coerces both into the typed filter the service expects.
    @Query() rawQuery: Record<string, unknown>,
  ): Promise<Paginated<Trade>> {
    const query = listTradesQuery.parse(normalizeArrayParams(rawQuery));
    return this.trades.list(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One trade with its executions and tags' })
  @ApiZodResponse(200, tradeSchema)
  async get(@Tenant() organizationId: string, @Param('id') id: string): Promise<Trade> {
    return this.trades.get(organizationId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({
    summary: 'Record a trade from its executions',
    description:
      'P&L, average prices, duration and the R-multiple are derived from the executions; they are not accepted from the client.',
  })
  @ApiZodBody(createTradeRequest)
  @ApiZodResponse(201, tradeSchema)
  async create(
    @Tenant() organizationId: string,
    @Body(zodBody(createTradeRequest)) body: ReturnType<typeof createTradeRequest.parse>,
  ): Promise<Trade> {
    return this.trades.create(organizationId, body);
  }

  @Patch('bulk')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Apply one change to many trades' })
  @ApiZodBody(bulkUpdateTradesRequest)
  async bulkUpdate(
    @Tenant() organizationId: string,
    @Body(zodBody(bulkUpdateTradesRequest)) body: ReturnType<typeof bulkUpdateTradesRequest.parse>,
  ): Promise<{ updated: number }> {
    return this.trades.bulkUpdate(organizationId, body);
  }

  @Post('bulk-delete')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete many trades' })
  @ApiZodBody(bulkDeleteTradesRequest)
  async bulkDelete(
    @Tenant() organizationId: string,
    @Body(zodBody(bulkDeleteTradesRequest)) body: ReturnType<typeof bulkDeleteTradesRequest.parse>,
  ): Promise<{ deleted: number }> {
    return this.trades.bulkDelete(organizationId, body.tradeIds);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Edit a trade, optionally replacing its executions' })
  @ApiZodBody(updateTradeRequest)
  @ApiZodResponse(200, tradeSchema)
  async update(
    @Tenant() organizationId: string,
    @Param('id') id: string,
    @Body(zodBody(updateTradeRequest)) body: ReturnType<typeof updateTradeRequest.parse>,
  ): Promise<Trade> {
    return this.trades.update(organizationId, id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a trade and its executions' })
  async remove(@Tenant() organizationId: string, @Param('id') id: string): Promise<void> {
    await this.trades.remove(organizationId, id);
  }
}

/**
 * Express gives `?tagIds=a&tagIds=b` as an array but `?tagIds=a` as a bare
 * string, so a single-value filter would fail an array schema. This lifts the
 * known repeatable keys into arrays before validation.
 */
const REPEATABLE_KEYS = ['symbols', 'instrumentClasses', 'tagIds'] as const;

export function normalizeArrayParams(query: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...query };

  for (const key of REPEATABLE_KEYS) {
    const value = normalized[key];
    if (typeof value === 'string') {
      // Both repeated keys and a comma-separated list are accepted.
      normalized[key] = value.includes(',') ? value.split(',').map((part) => part.trim()) : [value];
    }
  }

  return normalized;
}
