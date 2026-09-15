import path from 'node:path';

/**
 * Candidate `.env` file locations, in precedence order (later entries win).
 *
 * - `<app-dir>/.env`      — app-local overrides committed per developer machine.
 * - `<repo-root>/.env`    — the single source of truth for the monorepo.
 *
 * `__dirname` is `src/config` under `ts-node`/`nest start` and `dist/config`
 * after compilation, so the relative hops land on the same directories in both.
 */
export const envFilePaths = [
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env'),
];
