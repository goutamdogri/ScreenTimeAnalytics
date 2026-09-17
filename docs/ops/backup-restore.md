# Backup & Restore

Backups are plain `pg_dump` against `DATABASE_URL` — identical for local
Docker Postgres, VPS Postgres, and managed cloud Postgres (Render/GCP/AWS).

## Backup

```sh
pnpm db:backup                 # DATABASE_URL from repo-root .env, dump ->./backups/
DATABASE_URL=postgresql://…  pnpm db:backup
BACKUPS_DIR=/mnt/backup       pnpm db:backup
```

Each run writes `backups/screen-time-<UTC-timestamp>.dump` (custom format,
no-owner — restorable anywhere).

## Restore

```sh
pnpm db:restore backups/screen-time-<timestamp>.dump
# or point at a specific DB:
DATABASE_URL=postgresql://… pnpm db:restore backups/foo.dump
```

Drops + recreates the target DB's objects (`--clean --if-exists`), so the
target database must exist.

## Local Compose (self-hosted)

```sh
# dump:
docker compose exec db pg_dump --format=custom --no-owner -U screen screen_time > backups/screen.x.dump
# restore (target DB must exist):
cat backups/screen.x.dump | docker compose exec -T db pg_restore --clean --if-exists --no-owner -U screen -d screen_time
```

(`scripts/backup.sh` also works against `localhost:5432` while compose is up.)

## Scheduling & offload

- Cron / systemd timer on a VPS, or a managed backup (e.g. automated Postgres
  snapshots) — prefer one of:
  - `0 3 * * * cd /path/repo && pnpm db:backup`
  - Render/cloud automated daily backups (no script needed).
- Offload dumps off-box (S3/backblaze/rsync) — at minimum keep one copy away
  from the server's disk.
- Retention: prune old dumps to taste (e.g. keep 14 daily + monthly).

## What is NOT in the DB backup path

Encrypted user LLM keys live in the DB and are covered by these dumps — the
`ENCRYPTION_MASTER_KEY` must be recoverable separately or the restored keys
cannot be decrypted.
