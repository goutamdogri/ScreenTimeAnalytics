# Deployment & Shipping Guide

Concise runbook for deploying **every component on every supported platform**.
The backend is a cloud-agnostic 12-factor service; the agent/UI/extension are
shipped as artifacts for the user's OS.

---

## 1. Component × platform matrix

| Component                 | Platforms                | Artifact                                                                | Install / Run                                                                        |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Backend** (NestJS API)  | any Linux/cloud (Docker) | OCI image `ghcr.io/goutamdogri/ScreenTimeAnalytics/screen-time-backend` | container runtime of the provider; see §3                                            |
| **Desktop Agent**         | Ubuntu/Debian (X11)      | systemd service                                                         | `sudo scripts/install-agent.sh` → `systemctl start screen-time-agent`                |
| "                         | Ubuntu/Wayland → GNOME   | systemd service **+ GNOME Shell extension**                             | install-agent.sh **and** install `packages/adapters/gnome-shell-extension` (ADR-007) |
| "                         | Windows 10/11            | portable zip (`screen-time-agent-<v>-win32-x64.zip`)                    | Node.js ≥ 20 + unzip + start via Task Scheduler / nssm                               |
| "                         | macOS / unsupported      | portable zip                                                            | runs via `NullAdapter` (records nothing until an adapter exists)                     |
| **Desktop UI** (Electron) | Linux                    | AppImage (`release/`)                                                   | `pnpm --filter @screen-time/desktop-ui pack:linux`                                   |
| "                         | Windows                  | NSIS installer (`.exe`)                                                 | `pack:win`                                                                           |
| "                         | macOS                    | DMG                                                                     | `pack:mac`                                                                           |
| **Browser Extension**     | Chrome/Edge (MV3)        | `release/screen-time-extension.zip`                                     | unzip → Load unpacked                                                                |
| "                         | Firefox                  | —                                                                       | needs MV3 conversion (not yet supported)                                             |

**Agent ↔ backend wiring is the only cross-machine config:** point
`STA_API_BASE_URL` at the backend public URL (self-hosted `http://localhost:3000`,
cloud `https://<your-domain>`). Desktop UI is a pure API client — point it at
the same URL in Settings.

---

## 2. Backend — the cloud-agnostic core

Twelve-factor by construction: config from env (`ConfigModule` + fail-fast
validation), migrations auto-applied at boot (`prisma migrate deploy`), probes
via `GET /health`, stateless and horizontally scalable, graceful SIGTERM
shutdown.

Build the image:

```sh
docker build -f apps/backend/Dockerfile -t screen-time-backend .
```

### Environment variables (all optional development defaults; production-required ⚠)

| Variable                                     | Purpose                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` ⚠                             | Postgres DSN — works identically with local, managed (Render/GCP/AWS) or VPS Postgres                        |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` ⚠ | `openssl rand -base64 48` each                                                                               |
| `ENCRYPTION_MASTER_KEY` ⚠                    | `openssl rand -base64 32` — AES-256-GCM for stored LLM keys (§3.3); inject from your provider's secret store |
| `NODE_ENV`                                   | `production` for cloud/VPS (enables the ⚠ checks + trust-proxy)                                              |
| `PORT`                                       | Render/cloud inject it; default 3000                                                                         |
| `CORS_ORIGINS`                               | comma-separated allowed origins (add deployed UI/web origin)                                                 |
| `LLM_OLLAMA_URL`                             | `http://localhost:11434` — reachable only when self-hosting locally                                          |
| `CLASSIFICATION_*`, `SESSION_FINALIZER_*`    | worker tuning (safe defaults)                                                                                |

Cloud-LLM classification (Groq etc.) needs **no env key** — the user's API key
is entered in the app Settings and stored encrypted in Postgres. The master key
above decrypts it at request time; the plaintext never touches `.env` or logs.
⚠ **Rotation of `ENCRYPTION_MASTER_KEY` requires re-encrypting stored keys**
(future tooling) — treat it as long-lived like a DB root password.

---

## 3. Provider runbooks

### 3a. Render (blueprint)

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → connect the repo → `render.yaml` is detected.
3. Fill **sync: false** vars in the dashboard:
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_MASTER_KEY`.
   Adjust `CORS_ORIGINS` and `DATABASE_URL` (auto-linked to the managed PG).
4. Deploy; wait for `/health` to go green.
5. Register an account, add a device, and enter your **Groq key** in Settings.

### 3b. VPS + Docker + Caddy

```sh
# 1. install Docker Engine + compose plugin on the VPS, then:
git clone git@github.com:goutamdogri/ScreenTimeAnalytics.git && cd ScreenTimeAnalytics
cp .env.example .env          # set at least POSTGRES_PASSWORD, JWT_*, ENCRYPTION_MASTER_KEY
# 2. point a DNS A record at the VPS and set it in deploy/vps/Caddyfile
sudo docker compose -f docker-compose.prod.yml up -d
```

Caddy terminates TLS automatically (port 80/443). Postgres is internal-only.

### 3c. Mapping to any other provider (generic)

- **Runtime:** the Docker image (or `docker build`) into your platform —
  Render/Railway/Fly/Cloud Run/K8s/VPS all accept it. No provider-specific code.
- **Postgres:** any managed instance works — set its DSN as `DATABASE_URL`.
- **Secrets:** put `JWT_*` + `ENCRYPTION_MASTER_KEY` in that platform's secret
  manager / env editor (never in the repo). Migrations run automatically at
  first boot.
- **Scale:** horizontal — the backend is stateless; workers are in-process.

---

## 4. Desktop Agent per platform

### Ubuntu / Debian (X11)

```sh
git clone git@github.com:goutamdogri/ScreenTimeAnalytics.git && cd ScreenTimeAnalytics
sudo scripts/install-agent.sh          # builds -> /opt/screen-time-agent, writes /etc/screen-time-agent.env, enables service
# edit /etc/screen-time-agent.env (STA_API_BASE_URL, …) then:
sudo systemctl start screen-time-agent
journalctl -u screen-time-agent -f    # logs
sudo scripts/uninstall-agent.sh        # remove
```

### Wayland / GNOME

Same as X11 **plus** the window-probe GNOME extension (ADR-007):

```sh
cp -r packages/adapters/gnome-shell-extension \
  ~/.local/share/gnome-shell/extensions/
gnome-extensions enable screentime.windowprobe@goutamdogri
```

Extensions load on next login; without it the agent degrades to no
active-window tracking (idle/media still work).

### Windows 10/11

1. Install Node.js ≥ 20.
2. `scripts/package-agent.sh` (or a CI build) → `release/screen-time-agent-<v>-win32-x64.zip`.
3. Unzip, run `node dist/cli.js run` with `STA_API_BASE_URL` set — or persist:
   Task Scheduler (logon trigger) or `nssm install screen-time-agent /usr/bin/node …`.
   Active window/idle work via PowerShell (PS 5.1+), media via SMTC.

### macOS / other

The zip runs but uses `NullAdapter` (tracks nothing) until a macOS adapter ships.

---

## 5. Desktop UI (Electron)

```sh
pnpm --filter @screen-time/desktop-ui pack:linux   # release/…AppImage
pnpm --filter @screen-time/desktop-ui pack:win     # release/…setup.exe (run on Windows/Wine)
pnpm --filter @screen-time/desktop-ui pack:mac     # release/…dmg (run on macOS)
```

Artifacts land in `apps/desktop-ui/release/`. Apps are unsigned for now (OS
may warn); code signing is a separate release step.

---

## 6. Browser extension

```sh
scripts/package-extension.sh    # -> release/screen-time-extension.zip
```

Unzip → `chrome://extensions` → Developer mode → **Load unpacked**. Posts to
the agent's loopback server (`127.0.0.1:8765`); no other setup.

---

## 7. Image distribution (GHCR)

`.github/workflows/publish-image.yml` builds `linux/amd64 + linux/arm64` and pushes:

- `ghcr.io/<owner>/<repo>/screen-time-backend:latest` on every main merge
- `…:<version>` on `v*` tags

Requires a repo secret `GH_TOKEN` (PAT with `write:packages`). `docker-compose.prod.yml`
pulls `:latest` by default; pin a tag for production.
