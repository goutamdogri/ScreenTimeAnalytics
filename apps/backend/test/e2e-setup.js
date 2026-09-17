const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = async () => {
  // The classification worker polls the DB and calls real providers — keep it
  // out of the e2e run so tests don't race with async enrichment.
  process.env.CLASSIFICATION_WORKER_DISABLED = '1';
  process.env.SESSION_FINALIZER_DISABLED = '1';
  // Tests materialize sessions deterministically by invoking the finalizer
  // service directly; a 1ms settle means freshly seeded events close instantly.
  process.env.SESSION_FINALIZER_SETTLE_MS = '1';
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set for e2e tests. Copy .env.example to .env and start Postgres first.',
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runPendingMigrations } = require('../../../packages/db/dist/migrate');
  await runPendingMigrations({ databaseUrl: process.env.DATABASE_URL });
};
