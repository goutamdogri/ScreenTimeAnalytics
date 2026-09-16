import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Swagger document generation introspects decorators; it never touches the
// database. Provide placeholders so the config validation passes even when
// this script runs in CI without a real .env (the app won't connect).
// Note: AppModule is imported dynamically below so these assignments run
// before ConfigModule.forRoot() is evaluated at module load time.
process.env.DATABASE_URL ??=
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'generate-openapi-placeholder-access';
process.env.JWT_REFRESH_SECRET ??= 'generate-openapi-placeholder-refresh';
// The classification worker must not run while we only introspect decorators.
process.env.CLASSIFICATION_WORKER_DISABLED ??= '1';

async function generate(): Promise<void> {
  const { AppModule } = await import('../app.module');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  await app.init();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Screen Time Analytics API')
    .setDescription('Backend for the Screen Time Analytics desktop analytics platform.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outputPath = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'packages',
    'api-contract',
    'openapi.json',
  );
  await writeFile(outputPath, JSON.stringify(document, null, 2), 'utf8');

  console.log(`openapi.json written to ${outputPath}`);
  await app.close();
}

void generate().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI document', error);
  process.exitCode = 1;
});
