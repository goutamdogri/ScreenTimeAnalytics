import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PARENT = Symbol.for('ScreenTimeAnalytics.databasePackageRoot');

function getPackageRoot(): string {
  const global = globalThis as unknown as Record<symbol, string | undefined>;
  const cached = global[PARENT];
  if (cached) {
    return cached;
  }
  const root = path.resolve(__dirname, '..');
  global[PARENT] = root;
  return root;
}

function resolvePrismaCli(): string {
  const packageRoot = getPackageRoot();

  const candidates = [
    path.join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(packageRoot, 'node_modules', '.bin', 'prisma'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const requireFromHere = createRequire(__filename);
  return requireFromHere.resolve('prisma/build/index.js');
}

function resolvePrismaConfig(): string {
  return path.join(getPackageRoot(), 'prisma.config.ts');
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface RunPendingMigrationsOptions {
  /** Enables overriding the database URL without touching `process.env`. */
  databaseUrl?: string;
  /** Total number of attempts before giving up. Defaults to `5`. */
  retries?: number;
  /** Delay between retries in milliseconds. Defaults to `2000`. */
  retryDelayMs?: number;
  /** Optional logging callback. Defaults to a no-op. */
  log?: (message: string) => void;
}

const DefaultRetries = 5;
const DefaultRetryDelayMs = 2000;

/**
 * Applies any pending Prisma migrations to the configured database.
 *
 * This is the safety net that guarantees the backend never boots against a
 * schema behind its migration history: it is idempotent (`prisma migrate
 * deploy` applies exactly the migrations not yet applied), safe to run from
 * several instances concurrently, and retries transient database-connectivity
 * failures before giving up.
 *
 * @throws {Error} if the database cannot be reached or a migration fails after
 * the retry budget is exhausted — callers (e.g. the backend bootstrap) should
 * treat this as fatal.
 */
export async function runPendingMigrations(
  options: RunPendingMigrationsOptions = {},
): Promise<void> {
  const {
    databaseUrl,
    retries = DefaultRetries,
    retryDelayMs = DefaultRetryDelayMs,
    log = () => undefined,
  } = options;

  const url = databaseUrl ?? process.env.DATABASE_URL ?? '';
  if (!url) {
    throw new Error(
      'Cannot run migrations: DATABASE_URL is not set. ' +
        'Set DATABASE_URL in the environment or pass `databaseUrl` explicitly.',
    );
  }

  const cliPath = resolvePrismaCli();
  const configPath = resolvePrismaConfig();
  const packageRoot = getPackageRoot();
  const args = ['migrate', 'deploy', `--config=${configPath}`];

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
        cwd: packageRoot,
        env: { ...process.env, DATABASE_URL: url },
      });
      if (stdout) {
        log(`${stdout.trim()}`);
      }
      if (stderr) {
        log(`${stderr.trim()}`);
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= retries) {
        throw new Error(`Database migration failed after ${attempt} attempt(s): ${message}`, {
          cause: error,
        });
      }
      log(
        `Database migration attempt ${attempt}/${retries} failed: ${message}. ` +
          `Retrying in ${retryDelayMs}ms...`,
      );
      await delay(retryDelayMs);
    }
  }
}
