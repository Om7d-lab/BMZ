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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createTagRequest, tag as tagSchema, updateTagRequest, type Tag } from '@bmz/contracts';
import { TagsService } from './tags.service.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { Tenant } from '../../common/decorators/tenant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiStandardErrors, ApiZodBody, ApiZodResponse } from '../../common/swagger/zod-openapi.js';

@ApiTags('tags')
@ApiStandardErrors({ status: 404, description: 'No such tag in this workspace' })
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List setup, mistake, emotion and custom tags' })
  @ApiZodResponse(200, z.array(tagSchema))
  async list(@Tenant() organizationId: string): Promise<Tag[]> {
    return this.tags.list(organizationId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create a tag' })
  @ApiZodBody(createTagRequest)
  @ApiZodResponse(201, tagSchema)
  async create(
    @Tenant() organizationId: string,
    @Body(zodBody(createTagRequest)) body: ReturnType<typeof createTagRequest.parse>,
  ): Promise<Tag> {
    return this.tags.create(organizationId, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Rename or recolour a tag' })
  @ApiZodBody(updateTagRequest)
  @ApiZodResponse(200, tagSchema)
  async update(
    @Tenant() organizationId: string,
    @Param('id') id: string,
    @Body(zodBody(updateTagRequest)) body: ReturnType<typeof updateTagRequest.parse>,
  ): Promise<Tag> {
    return this.tags.update(organizationId, id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag and unlink it from its trades' })
  async remove(@Tenant() organizationId: string, @Param('id') id: string): Promise<void> {
    await this.tags.remove(organizationId, id);
  }
}
