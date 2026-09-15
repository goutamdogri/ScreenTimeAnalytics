const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set for e2e tests. Copy .env.example to .env and start Postgres first.',
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runPendingMigrations } = require('../../../packages/db/dist/migrate');
  await runPendingMigrations({ databaseUrl: process.env.DATABASE_URL });
};
