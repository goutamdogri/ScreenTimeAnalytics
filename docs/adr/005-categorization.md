# ADR 005 — Categorization: Rule Layer + Async LLM Content Enrichment

## Status

Accepted — September 2026

## Context

Each captured event is a raw observation of desktop/window/tab activity, but the
product surface (§3.1) works in terms of content categories. Categorization must
be:

1. **Cheap and deterministic** for the common cases so ingest latency is never
   paid by an external model call;
2. **Per-user and configurable** for the long tail (any website, any video) that
   rules cannot enumerate;
3. **Private** — the content classifier must run either on-device or through a
   provider the user chooses; no request should leave the machine without an
   explicit opt-in.

## Decision

A two-stage pipeline (design doc §3.2) operating on `raw_events`:

- **Stage 1 — rule layer (synchronous, in-process).** `packages/core`
  (`categorizeEvent`) assigns a category during ingest via
  `DEFAULT_CATEGORY_RULES`: structured host/app rules (deep_work, learning,
  social, music/audio, communication…), a short-form-video detector
  (`youtube.com/shorts`, `instagram.com/reels`), and a browser fallback
  (`extension`+`browse` → `browsing_research`). Deterministic, microlatency, and
  always on — even for users with no LLM configured. Rules are versioned in the
  core package so the taxonomy can never drift from validation.

- **Stage 2 — LLM content layer (asynchronous worker).** Rows the rules cannot
  resolve (`category IS NULL`) that carry a URL or window title become the
  worker queue. A polling worker (`ClassificationWorkerService`) enriches them
  with the user's configured provider (design doc §3.3):
  - **Never on the ingest path.** A `ClassificationService.apply` write happens
    after the fact; users see rule-categorized events immediately.
  - **Cache by URL.** `classification_cache` (unique `url`) ensures the same page
    is classified once; the cache survives event churn.
  - **Degrade safely (§8.4).** A failing provider, a 5xx, or an unparsable model
    response leaves the row _uncategorized_ (never wrongly categorized) and does
    not abort the batch. Zero-confidence/unparsable responses are not persisted
    nor cached.

- **Per-user provider settings (§3.3).** `llm_config` stores `provider`, `model`,
  and an `encryptedApiKey` (AES-256-GCM, key from `ENCRYPTION_MASTER_KEY`).
  Providers: OpenAI, Groq (OpenAI-compatible), Gemini (REST), and local Ollama
  (auto-detected at `LLM_OLLAMA_URL`). Only URL + page title are ever sent;
  worker input is scoped to events whose user configured a provider.

- **UI guidance.** `GET /llm/providers` reports Ollama availability by an active
  network probe (no manual toggle); cloud items show whether the user has a key
  stored (`configured`).

## Alternatives Considered

- **LLM on the ingest path** — simplest, but couples event delivery to provider
  latency/outages and makes the worker/cache unnecessary. Rejected.
- **Scrape page content in the extension (DOM → LLM)** — better classification
  for some pages but substantially less private and heavier; rejected for v1
  (URL + title only).
- **Client-side rules in the extension/agent only** — would fragment taxonomy
  across app boundaries; rules live in `packages/core` so backend, agent, and
  validation share one source of truth.
- **Single API key at the backend (self-hosted)** — simpler UI but centralizes
  keys and billing; the per-user config keeps cloud keys user-owned.
- **External job queue (Redis/BullMQ)** — overkill at this scale; the in-process
  polling worker + DB queue (uncategorized rows) meets the cap.

## Consequences

- Ingest remains rule-fast; LLM classification is eventual and best-effort.
- API keys are encrypted at rest with a per-deployment master key; `GET
/llm/config` only ever returns `hasApiKey` — never the key.
- Events the rules cannot classify yet that have no URL/title remain `NULL` and
  are simply inactive (no content-layer signal, no worker work).
- New categories/sub-categories must be added to `packages/core` taxonomy first;
  LLM validation (`parseLLMClassification`) automatically rejects unknown values
  by degrading to `other` at confidence 0.
- `CLASSIFICATION_WORKER_DISABLED=1` disables the worker (used in tests and the
  OpenAPI generator); `CLASSIFICATION_POLL_MS`/`CLASSIFICATION_BATCH_SIZE` tune
  the loop.
