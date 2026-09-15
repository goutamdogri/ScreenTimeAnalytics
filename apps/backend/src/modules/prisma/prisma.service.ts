import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaAdapter } from '@screen-time/db';
import { PrismaClient } from '@screen-time/db';

/**
 * NestJS-owned Prisma Client lifecycle.
 *
 * Extends `PrismaClient` directly so services get full type safety (including
 * `$transaction`, `$queryRaw`, and model delegates) through dependency
 * injection, with connect/disconnect tied to the module lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('database.url');
    super({
      adapter: createPrismaAdapter(connectionString),
      log: ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
