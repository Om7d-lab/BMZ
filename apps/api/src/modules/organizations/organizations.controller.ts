import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EntitlementsService } from './entitlements.service.js';
import { Tenant } from '../../common/decorators/tenant.decorator.js';
import { ApiStandardErrors } from '../../common/swagger/zod-openapi.js';

@ApiTags('organizations')
@ApiStandardErrors()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('current/entitlements')
  @ApiOperation({
    summary: 'What this workspace is entitled to',
    description:
      'The web app hides or explains gated features from this list rather than hard-coding plan names.',
  })
  async entitlementsForCurrent(@Tenant() organizationId: string) {
    return { entitlements: await this.entitlements.list(organizationId) };
  }
}
