# ADR 006 — Gamification Engine + Summarized `sessions` as the Single Source of Truth

## Status

Accepted — September 2026

## Context

Phases 1–4 end with raw observations (`raw_events`) and rule/LLM categories, but
no notion of discrete _usage_ and no reward loop. Two problems must be solved
together:

1. **What is a "session"?** Events are a timestamped stream; the product (design
   doc §3.4, §6) reasons in sessions (duration, category, intentionality). If
   sessions are derived ad hoc on every read, the dashboard and the gamification
   engine can disagree about the same data.
2. **When is XP earned?** The XP/quest/boss/streak engine (design doc §4) must
   award exactly once per qualifying session — a crash or a duplicate worker run
   must never double-award, and past progress must never be erased (design doc
   §4.2).

Additionally, one rare ingestion case needs a documented stance: an LLM
re-classification can land _after_ the events of a session have already been
summarized (design doc §3.2 stage 2 is asynchronous and out of band with
sessionization).

## Decision

### 1. Sessions are persisted, immutable, and the single source of truth

`raw_events` remains the audit-log clock; all **reads** (dashboard §5,
gamification §4) flow from a closed `sessions` row. A session is closed exactly
once and never mutated again (`pending` cleared, `status = 'closed'`).

### 2. SessionFinalizerWorker

A polling worker (`SessionsModule`) materializes sessions per device:

- **Open-cursor model (crash-safe).** Each device has at most one `status =
'open'` row carrying a `pending` JSON snapshot of every merged event. Snapshots
  are replayed after a restart, so a crash mid-window never splits a session.
- **5-minute gap rule, settle-locked.** `appendToWindow` closes a window when the
  next event is more than `SESSION_GAP_MS` (5 min) away — but a trailing window is
  only flipped to `closed` once `SESSION_FINALIZER_SETTLE_MS` (default 10 min) of
  _real silence_ has passed since its last event (settle ≥ gap). This absorbs
  buffered/offline agent bursts that reconnect late: a burst lands at `now`, but
  the window it belongs to has already been confirmed silent, so it can never
  split a single session. The close flip is an in-place update by `id`
  (preserving the `(device_id, started_at)` unique key).
- **Anchor/backfill.** Each tick resumes from the open cursor or the last closed
  session's `endedAt`, then drains all newer categorized focus events.
- **Only categorized materializes.** Rows with `category IS NULL` and
  `idle_afk` are deferred (see Rare case below).

### 3. XP/quest/stat/boss settled atomically at close

`GamificationService.syncUser(tx, userId, now)` runs **inside the same
transaction** that flips a session to `closed` — session close and all side
effects (XP, quest transitions, weekly boss, achievements, streak, `user_state`)
are one atomic unit.

Reconciliation is idempotent, rather than nested-trigger:

- `xp_log` carries a `sourceRef` and `@@unique(userId, sourceRef)`; session XP is
  `session:<id>`, quest/boss/achievement XP is `quest:<key:periodStart>`, etc. A
  crash between "session written" and "side effects set" simply re-runs `syncUser`
  on the next tick and skips sources already present. `user_state` is a pure
  cache recomputed as `Σ xp_log` (plus stat/streak aggregates), never written
  incrementally — so duplicate credit is structurally impossible and
  over-awarding on retry is a non-event.
- **No XP deduction.** A bad day applies temporary debuffs (quests revert to
  `active`, `streakDays` contracts, debuff multipliers) but never decreases
  cumulative `xp` (§4.2).

### 4. Dashboard reads closed sessions only

`DashboardService` (`summary`/`trends`/`categories`/`sessions`) queries the
`session` table (`status = 'closed'`), making dashboard totals, trends, category
shares, per-app minutes (`appMinutes` JSON), and gamification stats provably
derived from the same rows. A session's full `durationMin` is attributed to its
dominant (modal) category — a deliberate semantic shift from per-event
minute-splitting (see Consequences).

### 5. Rare case — LLM re-classification after persist

The finalizer only materializes already-categorized events; rows queued for the
content-layer worker (`category IS NULL`) are skipped and, once the LLM tags
them, never welded into a previous closed session — the next tick opens a fresh
cursor for them (a late-arriving session is still fully captured, just not merged
backwards into a closed one).

**Solve method (if required):** a re-classification that must retroactively change
a closed session is handled as a **re-flag + re-derive**, not an update-in-place:
the affected session row is deleted (or flipped to a versioned re-open marker),
the finalizer re-derives it from `raw_events` on the next tick, and `syncUser`
re-attributes pending quest/boss stats from the new session — with `xp_log`
sources keyed by `session:<id>` the source stays a single record, and any
quest/achievement XP already awarded remains credited (idempotent by key). Today
**no call site triggers this** (the rules are authored so domain/sub-domain rules
never change after ingest); the mechanism exists so the constraint set can grow
without a data-migration.

### 6. Configuration & test isolation

`SESSION_FINALIZER_DISABLED`, `SESSION_FINALIZER_POLL_MS` (30s),
`SESSION_FINALIZER_SETTLE_MS` (10 min default). Tests and the OpenAPI generator
disable the worker; e2e suites invoke `SessionsFinalizerService.finalizeDevice`
directly with `SETTLE_MS=1` for deterministic materialization.

## Alternatives Considered

- **Derive sessions on read (no summary table)** — simplest, but dashboard and
  gamification would each re-derive and could disagree; no atomic award point.
- **Deduplicate at ingest (skip flagged rows) instead of pending snapshots** —
  loses the open-window state needed to extend a session across a worker restart.
- **Timer-based sessions (fixed slots)** — simpler, but splits naturally-continuous
  work at artificial boundaries and can't reflect the 5-minute gap rule.
- **Award XP in a second worker (decoupled from close)** — retries would be
  indistinguishable from first awards without heavier exactly-once machinery;
  the same-transaction decision makes "crash between close and award"
  impossible by construction.
- **Serialized per-device in-flight lock (Redis/Singleton) for finalize** —
  the open-cursor snapshot + `@@unique(userId, sourceRef)` make concurrent ticks
  self-healing; a heavier coordinator wasn't justified at this scale.

## Consequences

- The dashboard's category split changes meaning: a 3-app interleaved stretch is
  one deep-work session (its modal category, full duration), not per-app minutes.
  Category _minutes_ still break down per app via `appMinutes` for the categories
  view.
- Sessions settle up to `settleMs` (typically 10 min) behind real time — the
  dashboard and gamification state always lag by that window, by design.
- Idempotence gives free retry safety: `finalizeDevice` can be invoked by cron,
  a worker loop, or an ad-hoc script without double counting.
- New stat/quest definitions live in `packages/core` (pure, unit-tested) and are
  computed from persistent sessions; nothing else changes.
- The rare reclassify case is documented with its solve method so future
  "re-categorize past week" features can be built on the same mechanism.
