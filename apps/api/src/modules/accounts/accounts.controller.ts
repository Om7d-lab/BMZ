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
import { z } from 'zod';
import {
  account as accountSchema,
  createAccountRequest,
  updateAccountRequest,
  type Account,
} from '@bmz/contracts';
import { AccountsService } from './accounts.service.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { Tenant } from '../../common/decorators/tenant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiStandardErrors, ApiZodBody, ApiZodResponse } from '../../common/swagger/zod-openapi.js';

@ApiTags('accounts')
@ApiStandardErrors({ status: 404, description: 'No such account in this workspace' })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List trading accounts with their balances' })
  @ApiZodResponse(200, z.array(accountSchema))
  async list(
    @Tenant() organizationId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<Account[]> {
    return this.accounts.list(organizationId, includeArchived === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'One trading account' })
  @ApiZodResponse(200, accountSchema)
  async get(@Tenant() organizationId: string, @Param('id') id: string): Promise<Account> {
    return this.accounts.get(organizationId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Add a trading account' })
  @ApiZodBody(createAccountRequest)
  @ApiZodResponse(201, accountSchema)
  async create(
    @Tenant() organizationId: string,
    @Body(zodBody(createAccountRequest)) body: ReturnType<typeof createAccountRequest.parse>,
  ): Promise<Account> {
    return this.accounts.create(organizationId, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Edit or archive a trading account' })
  @ApiZodBody(updateAccountRequest)
  @ApiZodResponse(200, accountSchema)
  async update(
    @Tenant() organizationId: string,
    @Param('id') id: string,
    @Body(zodBody(updateAccountRequest)) body: ReturnType<typeof updateAccountRequest.parse>,
  ): Promise<Account> {
    return this.accounts.update(organizationId, id, body);
  }

  @Delete(':id')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a trading account',
    description: 'Soft delete: the account and its trades stay recoverable.',
  })
  async remove(@Tenant() organizationId: string, @Param('id') id: string): Promise<void> {
    await this.accounts.remove(organizationId, id);
  }
}
