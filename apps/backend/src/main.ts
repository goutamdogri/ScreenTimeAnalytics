import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { runPendingMigrations } from '@screen-time/db';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const databaseUrl = config.getOrThrow<string>('database.url');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Screen Time Analytics API')
    .setDescription('Backend for the Screen Time Analytics desktop analytics platform.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, { swaggerUiEnabled: true });

  const port = config.getOrThrow<number>('port');
  const isProduction = config.getOrThrow<boolean>('isProduction');

  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableCors({
    origin: config.get<string[]>('cors.origins'),
    credentials: true,
  });

  logger.log('Applying pending database migrations…');
  await runPendingMigrations({ databaseUrl });

  await app.listen(port, '0.0.0.0');
  logger.log(`Screen Time backend listening on port ${port}`);
  if (!isProduction) {
    logger.log(`OpenAPI: http://localhost:${port}/api/docs`);
  }

  return app;
}

void bootstrap();
