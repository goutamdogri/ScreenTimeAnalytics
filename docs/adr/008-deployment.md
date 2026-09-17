# ADR 008 — Phase 7 Deployment Hardening

## Status

Accepted — September 2026

## Context

Phase 7 (design doc §7.7) hardens deployment: a cloud deployment target, a
secrets story for the master encryption key, and backup/export tooling — while
staying **cloud-agnostic** (§2.4) with no premature complexity. Constraints from
the project owner:

- Must be able to change cloud provider easily.
- No immediate deploy; everything should make _any_ provider deploy trivial.
- Reference targets picked for the test: **Render** (blueprint) and
  **VPS + Docker + Caddy**, plus a generic 12-factor mapping.
- Cloud LLM classification tested against **Groq**.
- Backend image distributed via **GHCR**, published from CI.
- Desktop agent shipped via **systemd + portable zip**.

## Decision

### Backend stays a plain 12-factor container

No provider SDKs, no lock-in. Env-driven config (already in place), migrations
auto-applied at boot, `GET /health`, graceful shutdown
(`app.enableShutdownHooks()` added), non-root `USER node` + `HEALTHCHECK` in the
Dockerfile. Any platform that runs containers + Postgres can host it; Redis/cache
not required (single-instance workers run in-process).

### Secrets stay out of the app — injected per provider

`ENCRYPTION_MASTER_KEY`, `JWT_*` are read from the environment (fail-fast in
production). Each provider's _own_ secret mechanism supplies them (Render
encrypted env vars, VPS `.env`/systemd `EnvironmentFile`, any KMS that exports
env). No in-app KMS client is built yet — adding one later touches only how the
secret is injected, not the code. Rotation of the master key is documented as
requiring re-encryption of stored LLM keys (future tooling); not built now.
**Groq needs no env key** — user API keys go in via the settings UI and are
encrypted at rest with that master key (design doc §3.3).

### Manifests are the only provider-specific surface

- `render.yaml` — Render blueprint (web service + managed Postgres, unset-secret
  env vars).
- `docker-compose.prod.yml` + `deploy/vps/Caddyfile` — VPS stack (backend from
  GHCR, internal Postgres, Caddy auto-TLS).
- Generic section in the ops docs maps the same image/env/DSN to any other
  provider. Changing providers = different manifest, not different app.

### Backups = plain Postgres tooling

`scripts/backup.sh` / `scripts/restore.sh` wrap `pg_dump`/`pg_restore` over
`DATABASE_URL`, exposed as `pnpm db:backup` / `pnpm db:restore`. Identical for
local, VPS, and managed Postgres because it is only a DSN. Backups land in
`backups/` (gitignored). Object-storage offload documented, not integrated.

### Shipping per platform

- **Agent:** `scripts/install-agent.sh` stages a self-contained install
  (`pnpm deploy`) at `/opt/screen-time-agent`, writes `/etc/screen-time-agent.env`
  once, and installs a systemd unit; `scripts/uninstall-agent.sh` removes it;
  `scripts/package-agent.sh` produces a portable zip (any OS incl. Windows).
  Wayland/GNOME additionally needs the ADR-007 window-probe extension.
- **Desktop UI:** electron-builder config existed but was unwired; added
  `pack:linux|win|mac` scripts. Artifacts unsigned for now.
- **Extension:** `scripts/package-extension.sh` zips manifest + `dist` (MV3,
  Chrome/Edge load-unpacked).

### CI & release

- `ci.yml` runs on PRs **and** pushes to `main`; adds the §2.6 contract check
  (regenerate OpenAPI → `git diff --exit-code` on `openapi.json`).
- New `publish-image.yml` builds `linux/amd64 + linux/arm64` on main/`v*`,
  pushes to GHCR under `ghcr.io/<owner>/<repo>/screen-time-backend`; gated on a
  `GH_TOKEN` (`packages:write`) secret.

## Alternatives Considered

- **In-app KMS SDK integration now (AWS/Azure/GCP).** Rejected as premature:
  it adds a provider dependency in exchange for nothing a secret-store env var
  already provides, and locks a provider in at the app layer.
- **More provider manifests (Railway/Fly/Cloud Run).** Dockerfile + env + DSN +
  healthcheck already make these trivial; writing each blueprint adds maintenance
  with no runtime benefit until actually used.
- **Litestream/volume-snapshot based backups.** Heavyweight for a personal-scale
  Postgres; `pg_dump` + documented offload is the industry-standard minimal path.
- **Standalone DB container with no packaging script.** Required but the UI's
  electron-builder already existed; wiring it was free.

## Consequences

- Deploying = choose a manifest → fill env → run. No app changes per provider.
- Master key is long-lived; rotating it requires re-encrypting stored user keys
  (documented, tooling deferred).
- Container images are signed with the project's creators / not signed at all
  for now; UI apps are unsigned (OS trust prompts remain).
- GHCR publishing is CI-only and needs the `GH_TOKEN` secret to exist before
  the workflow runs.
