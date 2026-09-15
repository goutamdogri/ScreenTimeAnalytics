# Screen Time Deep Analytics & Gamification — Project Design Doc

## 1. Overview

A screen-time analytics and gamification system with a **standard client-server architecture**: a NestJS backend (deployable to the cloud or run locally) owns the database, categorization, and gamification logic; a desktop agent captures OS-level activity and reports it over API; and the dashboard UI (Electron now, potentially web/mobile later) is a pure API client with no direct database access.

**Platform target (agent):** Ubuntu (X11) first, with provisions to add Wayland (GNOME) and Windows later without a rewrite.

**Core philosophy:** distinguish *what app* from *what content* from *how intentional the usage was* — and do it in an architecture that scales from "just me, one laptop, self-hosted" to "me, multiple devices, one account" to "multiple users on a hosted backend."

---

## 2. Architecture

### 2.1 Components

| Component | Runs where | Responsibility |
|---|---|---|
| **Backend (NestJS)** | Cloud **or** local (Docker) — your choice, same codebase | Auth, device/user management, event ingestion, categorization, LLM calls, aggregation, XP/quest engine. Owns the only connection to the database. |
| **Database (Postgres)** | Wherever the backend runs | Sits entirely behind the backend. Never accessed directly by any client. |
| **Desktop Agent** | User's laptop (always local — this is a hardware/OS necessity, not a choice) | Runs the `PlatformAdapter` (active window, idle, MPRIS), runs a small localhost server the browser extension posts to, batches and forwards events to the Backend API over HTTPS. |
| **Desktop UI** | User's laptop (Electron renderer) | Dashboard, gamification views, settings — a pure API client, no local DB, no direct OS access. Same shape a future web or mobile client would take. |
| **Browser Extension** | User's browser | Detects tab URL/title for content classification, posts to the local Agent (not directly to the backend — see 2.3). |

This split is what makes "connect a mobile app later" true in practice: the mobile app would be another **Desktop UI**-equivalent client hitting the same backend API — it never needs to know about adapters, Postgres, or LLM keys.

### 2.2 Platform Adapter Pattern (Agent only)

Unchanged in spirit from before, but now scoped entirely to the Agent — the backend never touches OS APIs:

```
interface PlatformAdapter {
  getActiveWindow(): { title: string; processName: string };
  onIdleChanged(callback): void;
  onMediaChanged(callback): void; // now-playing metadata
}
```

| Adapter | Backend | Status |
|---|---|---|
| `X11Adapter` | `active-win` / `xdotool` | **Build first** |
| `WaylandAdapter` | GNOME Shell extension exposing active-window over D-Bus (Wayland blocks cross-app window queries by design) | Stubbed, future |
| `WindowsAdapter` | Win32 active window API + SMTC for media | Stubbed, future |

Media/now-playing remains OS-native and local: **MPRIS** (Linux, D-Bus) and **SMTC** (Windows) — no API keys, no internet call needed for this part.

### 2.3 Data Flow

```
[Browser Extension] --localhost--> [Desktop Agent] --HTTPS/API--> [Backend (NestJS)] --> [Postgres]
[OS-level events]   -------------> [Desktop Agent] --HTTPS/API--> [Backend (NestJS)] --> [Postgres]
[Desktop UI] <--HTTPS/API (read: dashboards, XP, quests)-- [Backend (NestJS)]
```

- The extension posts to the Agent's **localhost-only** HTTP server rather than directly to the backend — this keeps auth/networking/batching logic in one place (the Agent), and the extension never needs to manage credentials or handle offline/retry logic itself.
- The Agent authenticates to the backend as a **registered device** under the user's account (see 2.5), batches raw events, and syncs them — with local buffering/retry if the backend is briefly unreachable (important for the cloud-hosted case, where network hiccups are normal).
- The Desktop UI talks to the backend purely for reads (dashboard data, XP/quest state) and writes (settings, manual deletions) — never touches raw event data directly.

### 2.4 Deployment Modes

Same backend codebase, different target — this is the actual meaning of "scalable" here:

- **Self-hosted (local):** `docker-compose up` runs Backend + Postgres on the user's own machine; Agent points its API base URL at `http://localhost:PORT`. Single device, no cloud cost, everything stays on-machine. Local LLM providers (Ollama) work cleanly here since the backend can reach `localhost:11434` directly.
- **Cloud-hosted:** Backend + Postgres deployed to a host (a VPS, Railway/Render/Fly.io initially, or AWS/GCP later); Agent points at the public API URL over HTTPS with device auth. Enables multi-device sync (laptop + future desktop, etc.) and multi-user accounts. **Local LLM providers are not reachable in this mode** unless you expose your local Ollama endpoint publicly (not recommended) — cloud-hosted deployments should use a cloud LLM provider.

### 2.5 Auth & Multi-Device/Multi-User

- **Auth:** NestJS + Passport, JWT access/refresh tokens. Passwords hashed with `argon2` (current industry-standard choice over bcrypt for new systems).
- **Users:** standard account model — one account can own multiple devices.
- **Devices:** each Agent instance registers itself under the user's account on first run, receiving a device-scoped token. Every ingested event carries a `device_id`, so the dashboard can show per-device breakdowns or aggregate across all of a user's devices.
- This is also what makes multi-tenancy (multiple *users*, not just multiple devices) close to free — the same `user_id` scoping that separates your two devices is what separates two different people's data.

### 2.6 API Contract — Build-Time Enforced

The goal: if the backend's API shape changes and the frontend isn't updated to match, **the frontend build fails with a TypeScript compile error** — never a runtime surprise in production. This is achieved by making the contract generated, not hand-written, and by having the frontend depend on that generated output directly rather than on hand-maintained types that can drift.

**How it works:**
1. **Backend is the source of truth.** Every endpoint's request/response shape is defined once, as NestJS DTOs decorated with `class-validator` + `@nestjs/swagger`. Nothing about the contract is written by hand a second time anywhere else.
2. **OpenAPI spec is generated from the backend** on every build (`@nestjs/swagger`'s `SwaggerModule.createDocument`), not maintained manually — it's a direct reflection of the actual DTOs and controllers.
3. **TypeScript types are code-generated from that spec** (e.g. via `openapi-typescript`) into `packages/api-contract`. This package is regenerated as part of the monorepo build — it is never hand-edited.
4. **Frontend uses a typed API client bound to those generated types** (e.g. `openapi-fetch`, typed against the generated schema) — every API call's request body and response shape is checked by the compiler, not assumed.
5. **Enforcement point:** the frontend build pipeline runs, in order: `regenerate api-contract from current backend` → `tsc --noEmit` (or the framework's equivalent build step) → bundle. If a backend DTO changed shape (a field renamed, removed, or retyped) and the frontend code wasn't updated to match the new generated types, step 2 fails the build immediately — with a compiler error pointing at the exact call site, not a 500 or a silently-wrong dashboard discovered in production later.

**In CI specifically** (tied into Section 8.3): a dedicated pipeline step regenerates the contract from the backend on every PR and fails the build if regeneration produces a diff the frontend code doesn't already compile against — so an out-of-sync contract can't be merged, let alone deployed.

This also means the contract package is versioned implicitly by the monorepo itself (same commit = same contract on both sides) rather than needing manual API-version coordination between two separately-released apps.

---

## 3. Content Categorization

### 3.1 Top-Level Categories
| Category | Primary Source | Examples |
|---|---|---|
| Deep Work | active window | VS Code, terminal, Obsidian, writing tools |
| Learning | window/tab rules + content layer | Coursera, docs, technical YouTube |
| Social Media | browser extension | Instagram, X, Reddit feed browsing |
| Short-form Video | browser extension | Reels, Shorts, TikTok-web |
| Long-form Video | browser extension + MPRIS | YouTube videos >4 min, Netflix |
| Music/Audio | MPRIS | Spotify, YouTube Music, podcasts |
| Communication | window/tab rules | Slack, Gmail, WhatsApp Web |
| Browsing/Research | browser extension | uncategorized domains |
| Idle/AFK | idle detection | screen on, no input |

### 3.2 Classification Pipeline
1. **Rule/whitelist layer** (instant, free): domain/app → category map, covers the large majority of traffic. Some domains need sub-rules (e.g. `youtube.com` splits into Learning vs Long-form vs Short-form based on content).
2. **Content-level layer** for ambiguous cases: the Agent/extension sends only **URL + page title** (no DOM scraping) up to the **Backend**, which runs the LLM classification (see 2.3 — this is backend-side, not client-side, so it can use the user's centrally configured provider/key and cache results across all of that user's devices). Results cached per URL so nothing is re-classified twice.

### 3.2.1 Long-form Video Sub-categorization

Long-form Video isn't left as a flat bucket — the same backend LLM classification step (URL + title) tags each video with a genre, using this default taxonomy:

| Sub-category | Examples |
|---|---|
| Educational/Tutorial | how-to, coding walkthroughs, courses |
| Documentary | long-form investigative/explainer content |
| Tech Review | product reviews, tech deep-dives |
| Entertainment/Comedy | sketches, comedy specials |
| Vlog/Lifestyle | personal vlogs, day-in-the-life |
| News/Commentary | news analysis, opinion/commentary channels |
| Podcast/Talk | long-form conversation/interview format |
| Music (long-form) | full albums, live performances, concerts |
| Other/Uncategorized | fallback when the LLM confidence is low |

This taxonomy lives in the same config-driven rule set as the top-level categories, editable without touching classification code. Genre is stored per-session in `sessions.sub_category` (Section 6), so dashboards can break "Long-form Video" time down by genre.

### 3.3 LLM Provider Configuration & Security

Classification runs **backend-side**, per user, configurable in-app:

- **Local provider:** point the backend at a local model server (e.g. Ollama). Only works when the backend itself is reachable to that Ollama instance — i.e. **self-hosted local deployment** (Section 2.4). No API key needed, no data leaves the machine.
- **Cloud provider:** select a provider (OpenAI, Anthropic, etc.) and model; requires an API key. Works in either deployment mode, and is the **only practical option for cloud-hosted deployments**.

**Automatic local-provider detection (no manual toggling required):** rather than exposing a "local vs cloud" switch the user has to reason about, the backend actively checks whether a local model server is reachable and the frontend reflects that automatically:

- On startup and periodically (or on-demand when the settings screen is opened), the backend health-checks Ollama's local API (e.g. `GET http://localhost:11434/api/tags`) and, if reachable, pulls the list of models actually available there.
- The backend exposes `GET /llm/providers` returning something like:
  ```json
  {
    "local": { "available": true, "models": ["llama3.1:8b", "qwen2.5:14b"] },
    "cloud": { "available": true, "configured": false }
  }
  ```
- The Desktop UI's provider dropdown is populated from this response — **"Local (Ollama)" only appears as an option when `local.available` is true**, with the actual pulled models listed (not a hardcoded guess). On a cloud-hosted backend, this will naturally come back `false` and the option simply won't render — no error message, no dead option to click.
- This means self-hosted-local users get local models working with zero configuration beyond having Ollama running, and cloud-hosted users are never shown a choice that can't work for them.

**API key handling — industry-standard, backend-side secret storage:**
- Keys are entered via the Desktop UI settings screen, sent once over HTTPS, and stored **only** in encrypted form in Postgres — application-level encryption (AES-256-GCM) using a master key held in the backend's environment/secrets store, never in the database itself.
- Decryption happens only in-memory, at the moment a classification request is made; the plaintext key is never logged, never returned to any client, never included in exports.
- For cloud deployments, the master key should itself live in a proper secrets manager (e.g. a cloud provider's KMS) rather than a plain env var — worth treating as a hardening step once you're past self-hosted/local use.
- Settings UI shows provider/model selection and connection status, with the ability to switch or clear the key at any time.

### 3.4 Intentionality Signals (computed, not manual)
- Session duration vs. category norm (a 90-second visit ≠ a 40-minute one)
- Scroll velocity / item-switch rate on feed-type content (proxy for doomscrolling)
- Time of day (late-night short-form is a strong autopilot signal)
- Session fragmentation (many rapid app switches = distracted, not intentional)

---

## 4. Gamification — RPG/XP System

Computed backend-side, naturally scoped per user (and aggregated across all of that user's devices).

### 4.1 Stats
- **Focus** — from Deep Work sessions
- **Wisdom** — from Learning content
- **Discipline** — from streaks and staying under category budgets
- **Restraint** — rises when actively resisting doomscroll/short-form patterns

### 4.2 XP Mechanics
- Base XP per qualifying session (Deep Work needs a minimum uninterrupted length, e.g. 20 min, to prevent farming)
- Streak multiplier, capped (e.g. 1.0x → 2.0x over 30 days)
- Daily/weekly quest completion grants bonus XP
- No XP deduction for bad days — a temporary debuff instead, so past progress is never erased
- **Level curve (default, tunable):** exponential — XP for level `N` = `100 × N^1.5` (rounded). Treat as a tuning parameter once real usage data exists.

### 4.3 Quests & Bosses
- Daily quests auto-generated from personal usage patterns
- Weekly "boss fight" — an aggregate weekly target, boss HP drains as Restraint rises
- One-time achievement badges

### 4.4 Currency & Cosmetics
Focus Coins from XP milestones, spent on cosmetic-only unlocks — nothing gameplay-relevant is gated.

### 4.5 Leaderboard
Reframed as "vs. your past self" — weekly/monthly personal-best comparisons. (Multi-user support from Section 2.5 leaves room for an opt-in social leaderboard later, but that's not the default.)

---

## 5. Visualization

- XP bar + level badge
- 4-axis radar chart: Focus / Wisdom / Discipline / Restraint
- GitHub-style streak heatmap
- Category budget rings
- Session timeline/Gantt view of the day
- Weekly boss HP bar
- Trend charts: category time over weeks/months, intentional vs. autopilot ratio
- (With multi-device support) optional per-device breakdown view

---

## 6. Data Model (high-level, lives entirely behind the Backend)

```
users              (id, email, password_hash, created_at)
devices            (id, user_id, name, platform, device_token, last_seen_at)
raw_events         (id, device_id, timestamp, source, app, window_title, url, event_type)
sessions           (id, device_id, start, end, app, category, sub_category, intentionality_score)
media_events       (id, session_id, track_title, artist, source_app, duration)
daily_rollups      (user_id, date, category, total_minutes, intentional_minutes)
xp_log             (id, user_id, timestamp, amount, source, stat_affected)
quests             (id, user_id, type[daily/weekly], criteria, status, reward_xp)
achievements       (id, user_id, name, unlocked_at)
user_state         (user_id, level, xp, focus, wisdom, discipline, restraint, coins, streak_count)
llm_config         (user_id, provider[local/cloud], model, encrypted_api_key, updated_at)
```

**Retention:** all data kept indefinitely by default. The Desktop UI provides a data-management view where the user can select date ranges, categories, devices, or individual sessions and delete them — deletion is the only way data leaves the database.

---

## 7. Build Phases

1. **Phase 1 — Backend & Auth skeleton:** NestJS project setup, Postgres + migrations, `users`/`devices` tables, JWT auth, device registration endpoint. Deployable locally via Docker from day one.
2. **Phase 2 — Agent core (X11):** `X11Adapter`, MPRIS listener, local event buffering, sync to Backend API.
3. **Phase 3 — Categorization:** rule-based mapping, browser extension → Agent → Backend event flow, backend-side LLM classification with configurable provider.
4. **Phase 4 — Dashboard:** Desktop UI (Electron/React) as a pure API client, visualizations from Section 5.
5. **Phase 5 — Gamification engine:** XP/stat calculation, quest generation, streak logic, boss-fight mechanics — all backend-side.
6. **Phase 6 — Platform expansion:** Wayland adapter, Windows adapter — isolated to the Agent's adapter layer, no backend changes needed.
7. **Phase 7 — Deployment hardening:** cloud deployment target (chosen host), secrets manager for the master encryption key, backup/export tooling.

---

## 8. Engineering Standards & Project Structure

Monorepo, with a clean boundary between the Backend (NestJS), the Agent (Electron/Node, OS-specific), and shared logic — reinforced now by the fact that Backend and Agent are genuinely separate deployable processes, not just separate folders.

### 8.1 Project Structure

```
screen-time-analytics/
├── apps/
│   ├── backend/             # NestJS API server — deployable to cloud OR run locally via Docker
│   ├── desktop-agent/        # Electron main process: OS adapters, MPRIS, local server for extension,
│   │                          #   syncs events to Backend API
│   ├── desktop-ui/           # Electron renderer / React dashboard — pure Backend API client
│   └── extension/            # Browser extension — posts to desktop-agent's localhost server
├── packages/
│   ├── core/                  # Pure business logic used by the Backend: categorization rules,
│   │                          #   intentionality scoring, XP/quest engine
│   ├── adapters/               # PlatformAdapter implementations — used only by desktop-agent
│   ├── llm-client/             # Provider-agnostic LLM classification client — used by Backend
│   ├── api-contract/           # OpenAPI-generated types/DTOs shared by backend, desktop-ui,
│   │                          #   and any future mobile client
│   └── db/                     # Postgres schema + migrations (Prisma recommended — strong
│                                #   type-safety and migration story; TypeORM is the NestJS-native
│                                #   alternative if preferred) — used only by the Backend
├── docs/                       # Architecture Decision Records, this design doc
├── docker-compose.yml          # Local self-hosted deployment: backend + postgres
└── package.json                # Workspace root (npm/pnpm workspaces)
```

`core` depends only on interfaces (`PlatformAdapter`, `LLMProvider`) from `api-contract`/`shared-types`, never on `apps/`. This keeps categorization and XP logic fully unit-testable without a database, a browser, or a real LLM call.

### 8.2 Code Quality Practices
- TypeScript strict mode across all packages
- ESLint + Prettier, enforced pre-commit via Husky + lint-staged
- NestJS's built-in layering (Controllers → Services → Repositories) kept strict — no business logic in controllers
- Dependency injection throughout (NestJS's DI container for backend services, manual DI for Agent adapters/LLM client) — this is what makes mocking possible in tests
- Schema validation at every boundary (`class-validator` DTOs on all API inputs; LLM classification responses validated before being trusted)
- Structured logging (NestJS's built-in `Logger`, or `pino` for higher throughput) instead of `console.log`
- DB migrations via Prisma Migrate (or TypeORM migrations) — never hand-run SQL

### 8.3 Testing & CI
- Unit tests (Jest, NestJS's default) for `core` and backend services — categorization rules, intentionality scoring, XP/level math, auth logic
- Integration tests for backend modules against a real local Postgres instance (e.g. via `docker-compose` in CI)
- E2E tests for critical API flows (NestJS's supertest-based e2e testing is built in)
- **API contract check** (see 2.6): regenerate `packages/api-contract` from the backend's live OpenAPI spec, then run the frontend's `tsc --noEmit` against it — this step fails the PR if the backend changed a shape the frontend hasn't adapted to, catching contract drift before merge rather than in production
- CI pipeline (GitHub Actions): lint + typecheck + test + contract check on every push, blocking merge on failure
- Adapter contract tests: a shared test suite any `PlatformAdapter` must pass, so Wayland/Windows adapters can't silently break the interface

### 8.4 Reliability & Robustness
- Idempotent event ingestion — deduplicated by timestamp+source+device so a crash/restart never double-counts
- Agent-side local buffering with retry — cloud-hosted deployments must tolerate brief network loss without losing events
- Graceful adapter degradation — a failed window-tracking or MPRIS call logs and continues rather than crashing the Agent
- Local backup/export path for the Backend's data, independent of deployment mode
- Architecture Decision Records in `docs/` for major choices (why NestJS, why Prisma, why cloud vs self-hosted defaults)

---

## 9. Decisions Log

- **Architecture:** standard client-server split — NestJS backend owns DB/logic; Desktop Agent handles OS-level capture only; Desktop UI is a pure API client — see Section 2.
- **Backend framework:** NestJS.
- **Deployment:** same backend codebase runs either self-hosted locally (Docker) or cloud-hosted; user's choice — see 2.4.
- **Multi-device/multi-user:** JWT auth, device registration per account, `user_id`/`device_id` scoping throughout the data model — see 2.5, Section 6.
- **XP curve:** exponential default (`100 × N^1.5`), tunable after real usage data exists — see 4.2.
- **Content signals:** URL + page title only, no DOM scraping — see 3.2.
- **Classification method:** backend-side LLM, user-configurable local (self-hosted only) or cloud provider/model — see 3.3.
- **Local-provider visibility:** backend auto-detects Ollama reachability/models and exposes it via `GET /llm/providers`; frontend only shows the local option when detected — no manual toggle, no dead options — see 3.3.
- **API contract enforcement:** contract is generated from backend DTOs (never hand-written), frontend types are code-generated from it, and CI/build regenerates + typechecks so a backend shape change without a matching frontend update fails the build — never surfaces in production — see 2.6, 8.3.
- **API key storage:** encrypted at rest in Postgres (AES-256-GCM, backend-held master key), never on any client — see 3.3.
- **Data retention:** indefinite by default; manual selective deletion via UI — see Section 6.
- **Engineering standards:** monorepo, strict TypeScript, NestJS DI, schema-validated boundaries, CI-enforced testing — see Section 8.
