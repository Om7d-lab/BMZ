import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  controllers: [OrganizationsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class OrganizationsModule {}
