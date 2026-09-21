import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import path from 'node:path';
import { validateEnvironment } from './config/configuration.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { TenantGuard } from './common/guards/tenant.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { TradesModule } from './modules/trades/trades.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repo-root .env serves every workspace; a local one overrides it.
      envFilePath: [
        path.resolve(import.meta.dirname, '../.env'),
        path.resolve(import.meta.dirname, '../../../.env'),
      ],
      validate: validateEnvironment,
      cache: true,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationsModule,
    AccountsModule,
    TradesModule,
    TagsModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order matters: authentication has to establish who the caller is before
    // the tenant guard can check what they are a member of.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
