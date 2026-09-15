# ADR 001 — Monorepo Tooling

## Status

Accepted — September 2026

## Context

We need a monorepo layout that supports a backend (NestJS + Prisma), multiple frontend apps (Electron, macOS AppKit, iOS Swift, visionOS), shared contract packages, and a desktop analytics adapters package. Dependencies must be managed across the workspace, with incremental builds and a consistent DX.

## Decision

- **pnpm workspaces** (strict dependency isolation, saves disk space, faster than npm/Yarn).
- **Turborepo** orchestrates `build`, `lint`, `typecheck`, `test`, and database tasks across all packages, caching aggressively.
- All shared packages are **compiled with tsc** (no JIT/tsx at runtime), CommonJS output, shared `tsconfig.base.json` at the root.
- The `packages/api-contract` package is built last via a `devDependency` on `@screen-time/backend`, which wires a Turborepo `^build` dependency so `openapi.json` is regenerated from NestJS Swagger before `api-contract`'s build script runs.
- Prisma is pinned to **7.10.0** (not the 8.0.0-rc.15 `latest` tag) and runs exclusively via a `prisma.config.ts` file with manual `.env` loading in `packages/db`.

## Alternatives Considered

- Yarn 4 — stricter workspace semantics, but poorer ecosystem support for Turborepo.
- Nx — heavier, more opinionated, overkill for a project of this size.
- Turborepo vs. plain scripts — caching incremental builds and the `^build` dependency graph saves significant CI time.

## Consequences

- pnpm's `workspace:*` protocol must be used for internal dependencies.
- `pnpm install --frozen-lockfile` is the only acceptable install path in CI.
- Turborepo tasks are configured in `turbo.json`; each workspace package owns its own `build`/`test`/`lint` scripts.
