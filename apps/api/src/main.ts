import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { corsOrigins } from './config/configuration.js';
import { ORGANIZATION_HEADER } from './common/guards/tenant.guard.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const origins = corsOrigins(config.get<string>('API_CORS_ORIGINS') ?? '');
  app.enableCors({
    // Credentials are on because auth rides in cookies, so the origin list has
    // to be explicit: "*" and credentials are not a valid combination.
    origin: origins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', ORGANIZATION_HEADER],
  });

  app.enableShutdownHooks();

  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BMZ Trade Lab API')
        .setDescription(
          'Trading-journal API. Every decimal value is transported as a string so no precision is lost in JSON. Requests act within one workspace, named by the ' +
            ORGANIZATION_HEADER +
            ' header.',
        )
        .setVersion('1.0')
        .addCookieAuth('bmz_access')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/openapi.json',
    });
    logger.log('API documentation at /api/docs');
  }

  const port = Number(config.get<number>('API_PORT') ?? 4000);
  await app.listen(port);
  logger.log(`BMZ Trade Lab API listening on port ${port}`);
}

void bootstrap();
