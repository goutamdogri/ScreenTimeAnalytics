# ADR 004 — Agent Backend Choice: Node/TS CLI on X11 via xprop + D-Bus

## Status

Accepted — September 2026

## Context

Phase 2 must capture per-window activity on the Linux desktop. The capture layer
runs inside a small agent process that reports to the backend over HTTP. Two
product/architecture decisions shape how that agent is built:

1. **Embedded/standalone CLI vs. Electron app.** The plan (§7.2) calls for a
   headless-ish agent; the Electron shell is a later phase (ADR-005 territory).
2. **The capture technique on X11.** Options range from X extensions (XInput /
   `_NET_ACTIVE_WINDOW` via Xlib/XCB) to shelling out to `xprop` plus D-Bus for
   idle/media.

## Decision

- **Agent = plain Node/TypeScript CLI** (`apps/desktop-agent`), as a `Package`,
  script style (CommonJS output), no framework. It exposes:
  - `login <email>`, `run`, `logout` subcommands;
  - JSONL event spool (crash-safe), sync loop with exponential back-off;
  - an optional loopback-only HTTP surface (`POST /event` for the browser
    extension, `GET /health`);
  - the `@screen-time/adapters` package behind an injectable factory.
    Everything is exercised in headless unit tests; no display is required in CI.
- **Window capture = `xprop` subprocess** (`xprop -root _NET_ACTIVE_WINDOW`, then
  `xprop -id <id> _NET_WM_NAME WM_NAME _NET_WM_PID`, process name via
  `/proc/<pid>/comm`). Idle = D-Bus `org.freedesktop.ScreenSaver.GetActiveTime`
  with a Mutter `org.gnome.Mutter.IdleMonitor.GetIdletime` fallback. Media =
  MPRIS `Get`/`PropertiesChanged` over D-Bus.
- **D-Bus client = `dbus-next`** (pure-JS fallback). Native `usocket` is _not_
  required; its node-gyp build is allowed to fail (see Consequences).
- **Sync semantics.** Events are buffered to a JSONL spool and pushed to
  `POST /events` in batches (`x-device-token` header). The backend deduplicates
  on the `(device_id, timestamp, source)` unique index with `skipDuplicates`, so
  retries are safe. Successful batches are trimmed from the spool; failures back
  off (5s → 60s cap) and keep their data.

## Alternatives Considered

- **Electron agent now** — heavier, requires packaging xprop/D-Bus glue into a
  windowed runtime, and makes headless CI coverage harder. Deferred to Phase 3+.
- **Xlib/XCB + native binding** — fast but requires native compilation and
  per-display lifecycle handling; `xprop` has zero extra runtime deps and is
  failure-isolated (the adapter degrades to `null` on any error).
- **A custom minimal D-Bus wire client** — rejected once `dbus-next` was
  verified live (ListNames/MPRIS/Mutter calls all succeeded via its JS
  transport). Less code to own.
- **Single tall events table w/ app-id PK for upsert** — rejected in favor of the
  raw spool + dedup index so historical observation integrity is preserved
  end-to-end before reconciliation rolls out (Phase 3).

## Consequences

- Requires `xprop`, `/proc`, and a D-Bus session bus at runtime; all three
  degrade gracefully (adapter returns `null`/`false`) so the agent still runs on
  minimal desktops (media/idle simply go unrecorded).
- GNOME-boxes without `org.freedesktop.ScreenSaver` use the Mutter IdleMonitor
  (interface is `org.gnome.Mutter.IdleMonitor`, path
  `/org/gnome/Mutter/IdleMonitor/Core`, and it reports **milliseconds** unlike
  ScreenSaver's seconds).
- `usocket@0.3.0` fail to build on Node 24 via node-gyp v7.1.2 (no callback
  invoked). It is allowed to fail (`allowBuilds` in `pnpm-workspace.yaml`);
  `dbus-next` uses its JS transport instead. If a future native path is needed,
  pin a newer `usocket` and remove the allowlist entry.
- The agent stores credentials at `~/.config/screen-time/agent.json` — a refresh
  token (rotated) plus the opaque device token; never the password.
- Device identity lives in the `x-device-token` header; event payloads carry no
  `deviceId`, keeping the wire contract clean and the dedup key server-side.
