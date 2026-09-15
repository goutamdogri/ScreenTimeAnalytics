# ADR 003 — Auth Strategy: JWT Access + Refresh Token Rotation

## Status

Accepted — September 2026

## Context

The desktop agents, macOS/iOS clients, and LLM-callback endpoints all need a standard, token-based auth mechanism. Sessions are not viable (no server-side session store in the Electron/agent architecture), so the system is fully stateless on the auth side, with refresh tokens providing revocation capability.

## Decision

- **Access tokens** — short-lived (15 minutes), JWTs signed with HMAC-SHA256, issued via `@nestjs/jwt`. Payload includes `sub` (user ID), `email`, and `tokenType: "access"`.
- **Refresh tokens** — long-lived (7 days), JWTs issued on login/registration. Payload includes `sub`, `email`, `jti` (unique token identifier), and `tokenType: "refresh"`. On each use the token is **atomically revoked** and a fresh one is issued (rotation); the `replacedById` column links old → new for revocation replay detection.
- Only the **SHA-256 hash** of the refresh token is stored in the database (`RefreshToken` model); the plaintext is never persisted.
- **argon2** (argon2id via the `argon2` npm package) is used for password hashing with sensible defaults (256 MB memory, 3 iterations, 1 parallelism).
- The backend exposes `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and `POST /auth/me` (token validation echo).
- Passport strategies: `jwt` (`JwtStrategy`), `jwt-refresh` (`RefreshTokenStrategy` via `ExtractJwt.fromBodyField('refreshToken')`), `local` (`LocalStrategy` with `usernameField: "email"`).

## Alternatives Considered

- **Opaque refresh tokens** (e.g. UUID stored in DB, no JWT) — simpler but less portable; the JWT approach lets desktop agents validate the token offline (for access control) before a network round-trip.
- **Keycloak/Auth0** — overkill for the self-hosted model; we want zero external dependencies.
- **Session cookies** — not viable across desktop agents and Electron processes.

## Consequences

- Desktop agents must store access + refresh tokens securely (macOS Keychain, Electron safeStorage, etc.).
- The `RefreshToken` model enables explicit revocation without invalidating all sessions.
- Refresh token reuse detection: if a revoked token is presented, the system checks `replacedById` and can flag the account for forced logout (Phase 2+).
- Access tokens cannot be revoked server-side without an allowlist; they are short-lived (15m) to limit the blast radius.
