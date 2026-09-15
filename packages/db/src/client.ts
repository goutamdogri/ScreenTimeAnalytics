import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from './generated/prisma/client';
import { PrismaClient } from './generated/prisma/client';

/**
 * Creates the Postgres driver adapter used by Prisma Client.
 * Exposed separately so `PrismaService` can extend `PrismaClient` directly.
 */
export function createPrismaAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString });
}

export interface PrismaClientOptions {
  /** Prisma log levels forwarded to the underlying client. */
  log?: Prisma.LogLevel[];
}

/**
 * Creates a configured {@link PrismaClient} wired to a Postgres driver adapter.
 *
 * The connection string may come from any source; callers are responsible for
 * injecting it (e.g. the backend's validated configuration).
 */
export function createPrismaClient(
  connectionString: string,
  options: PrismaClientOptions = {},
): PrismaClient {
  return new PrismaClient({
    adapter: createPrismaAdapter(connectionString),
    log: options.log ?? [],
  });
}
