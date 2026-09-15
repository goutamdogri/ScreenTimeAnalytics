import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The Prisma CLI is always run with the `packages/db` directory as cwd
// (pnpm workspace scripts and the in-process migration runner both do this).
const packageRoot = process.cwd();

// Load the repository-root `.env` first (it is the source of truth), then allow
// a package-local `.env` to override individual values.
const rootEnvPath = path.resolve(packageRoot, '..', '.env');
const localEnvPath = path.resolve(packageRoot, '.env');
loadEnv({ path: rootEnvPath });
loadEnv({ path: localEnvPath, override: true });

export default defineConfig({
  schema: path.join(packageRoot, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(packageRoot, 'prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
