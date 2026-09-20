import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  analyticsQuery,
  breakdownDimension,
  breakdownResponse,
  calendarResponse,
  dashboardOverview,
  equityCurve as equityCurveSchema,
  performanceSummary,
  type BreakdownResponse,
  type CalendarResponse,
  type DashboardOverview,
  type EquityCurve,
  type PerformanceSummary,
} from '@bmz/contracts';
import { AnalyticsService } from './analytics.service.js';
import { Tenant } from '../../common/decorators/tenant.decorator.js';
import { ApiStandardErrors, ApiZodResponse } from '../../common/swagger/zod-openapi.js';
import { normalizeArrayParams } from '../trades/trades.controller.js';

@ApiTags('analytics')
@ApiStandardErrors()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Headline performance over the filtered trades' })
  @ApiZodResponse(200, performanceSummary)
  async summary(
    @Tenant() organizationId: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<PerformanceSummary> {
    return this.analytics.summary(organizationId, analyticsQuery.parse(normalizeArrayParams(raw)));
  }

  @Get('equity-curve')
  @ApiOperation({ summary: 'Cumulative equity and its drawdown series' })
  @ApiZodResponse(200, equityCurveSchema)
  async equityCurve(
    @Tenant() organizationId: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<EquityCurve> {
    return this.analytics.equityCurve(
      organizationId,
      analyticsQuery.parse(normalizeArrayParams(raw)),
    );
  }

  @Get('overview')
  @ApiOperation({ summary: 'Everything the default dashboard renders, in one call' })
  @ApiZodResponse(200, dashboardOverview)
  async overview(
    @Tenant() organizationId: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<DashboardOverview> {
    return this.analytics.overview(organizationId, analyticsQuery.parse(normalizeArrayParams(raw)));
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Daily P&L for a calendar month or any date range' })
  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-31' })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiZodResponse(200, calendarResponse)
  async calendar(
    @Tenant() organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('accountId') accountId?: string,
  ): Promise<CalendarResponse> {
    const range = analyticsQuery.pick({ from: true, to: true }).parse({ from, to });

    if (!range.from || !range.to) {
      throw new BadRequestException('Both "from" and "to" are required, as YYYY-MM-DD');
    }
    if (range.from > range.to) {
      throw new BadRequestException('"from" must not be after "to"');
    }

    return this.analytics.calendar(organizationId, range.from, range.to, accountId);
  }

  @Get('breakdown/:dimension')
  @ApiOperation({
    summary: 'Performance grouped by symbol, tag, playbook, day, hour or duration',
    description:
      'Tag rows overlap: a trade with several tags is counted once under each, so the rows do not sum to the trade total.',
  })
  @ApiZodResponse(200, breakdownResponse)
  async breakdown(
    @Tenant() organizationId: string,
    @Param('dimension') dimension: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<BreakdownResponse> {
    const parsed = breakdownDimension.safeParse(dimension);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unknown dimension "${dimension}". Expected one of: ${breakdownDimension.options.join(', ')}`,
      );
    }

    return this.analytics.breakdown(
      organizationId,
      parsed.data,
      analyticsQuery.parse(normalizeArrayParams(raw)),
    );
  }
}
