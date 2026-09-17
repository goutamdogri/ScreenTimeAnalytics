# ADR 007 — Phase 6 Platform Expansion: Wayland (D-Bus probe) and Windows (PowerShell probes)

## Status

Accepted — September 2026

## Context

Phase 6 (design doc §7.6) adds a Wayland adapter and a Windows adapter to the
desktop agent, isolated to the agent's adapter layer — "no backend changes
needed." Two hard constraints shape the implementation:

1. **Wayland blocks cross-app window queries by design.** A plain client
   cannot read another application's windows (no X11-style
   `_NET_ACTIVE_WINDOW`). The GNOME Shell process itself is the only component
   that can see the focused window, so the Shell must be asked to do it.
2. **The dev machine is Linux; neither target can be executed here.** Wayland
   needs a GNOME session, Windows needs Windows. Whatever we build must still
   be fully unit-testable on Linux through injected fakes (the `CommandRunner`
   / `SessionBus` DI pattern already used by `X11Adapter`).

A secondary constraint surfaced during implementation: the backend validates
ingestion against `EVENT_SOURCES` in `@screen-time/core` (shared contract),
which shipped with only `x11`/`mpris`/`extension`. New adapters emit new
`source` values, so the enum had to grow — read on.

## Decision

### Wayland adapter = GNOME Shell extension + D-Bus poll

- New `packages/adapters/gnome-shell-extension/` ships a real GJS extension
  (GNOME Shell ≥ 45, ESM format). It caches `global.display.focus_window`
  (title + app id) and exports it over the session bus:
  - Service `org.screentime.WindowProbe`, path `/org/screentime/WindowProbe`,
    method `GetActiveWindow()` returning `(s s)` (title, appId), both empty
    when nothing is focused.
- `WaylandAdapter` (Node) polls that method through `dbus-next`, caching the
  last window exactly like `X11Adapter` caches `xprop` output. Idle uses the
  **same** `createIdleProbe` as X11 (`org.freedesktop.ScreenSaver` /
  `org.gnome.Mutter.IdleMonitor`), which already works on Wayland. Media stays
  on the bus-agnostic `MprisAdapter`. So Wayland = probe the extension + reuse
  existing idle/media paths.
- Polling (not a D-Bus signal) keeps the adapter symmetric with X11 and gives
  the contract tests one lifecycle model.

### Windows adapter = PowerShell subprocess probes

- Active window via P/Invoke `GetForegroundWindow`/`GetWindowText`/
  `GetWindowThreadProcessId`; idle via `GetLastInputInfo`; media (SMTC) via
  `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager`
  with the `WindowsRuntimeSystemExtensions.AsTask` bridge. Each prints one
  JSON line, parsed by pure functions in
  `src/windows/powershell-scripts.ts`.
- These run through the **existing `CommandRunner`** abstraction, so every
  script builder + parser is unit-tested on Linux with fake runners — the
  same technique that already tests `xprop` parsing without X11.
- Media gets its own `SmtcAdapter` (PlatformAdapter, media-only) mirroring
  `MprisAdapter` exactly.

### No-op adapter for unsupported platforms

`NullAdapter` implements `PlatformAdapter` with no signals, so macOS/unknown
hosts still start the agent and simply record nothing (design doc §8.4).

### Adapter contract tests strengthened

`runAdapterContractTests` now asserts `start()` idempotency, `stop()` safety,
and that every signal accessor survives `dispose()`. X11, MPRIS, Wayland,
Windows, SMTC (and Null) all run the same suite (design doc §8.3).

### Agent-side selection and the shared `source` enum

- `apps/desktop-agent/src/adapter-factory.ts` resolves the platform from
  `process.platform` + `XDG_SESSION_TYPE`, honoring `STA_PLATFORM`/config
  overrides. `runtime.ts` consumes a generic `{ active, media }` pair of
  `PlatformAdapter`s.
- `EVENT_SOURCES` (core) was widened additively with `wayland`, `windows`,
  `smtc`, and the categorizer's state-level rules now map Wayland/Windows idle
  → `idle_afk` and SMTC media → `music_audio`. This is the **only** touch
  outside `packages/adapters`: the backend DTO validates `source` with
  `@IsIn(EVENT_SOURCES)`, so without it the new events would be rejected at
  ingest. The OpenAPI contract regenerates the enum automatically (design doc
  §2.6).
- Device registration reports the resolved platform (`linux-x11`,
  `linux-wayland`, `windows`, …), so dashboards can break usage down per OS
  without the config default leaking `auto`.

## Alternatives Considered

- **Native node module (node-gyp) for Windows.** Faster per probe, but needs
  a Windows toolchain to build and cannot be compiled or verified on this
  Linux box. Rejected: PowerShell keeps the dependency graph zero and the
  whole adapter testable here.
- **D-Bus signals instead of polling for Wayland.** Messages on focus change
  would be lighter, but forces a divergent lifecycle on Wayland only; polling
  matches X11 and the shared contract suite.
- **Reuse `active-win`/`active-win`-style libraries.** Pulls a native
  dependency tree for a problem the child-process approach already solves
  with the abstraction in place.
- **Monkey-patching the backend to accept any source.** Rejected: the source
  enum is the canonical data-model contract (§2.6); widening it in core is the
  honest, additive change and flows through Swagger/typegen automatically.

## Consequences

- Wayland tracking requires the GNOME extension installed + enabled
  (`~/.local/share/gnome-shell/extensions/<uuid>/`). Without it — or on a
  non-GNOME compositor — `createWindowProbe` returns `null` and the adapter
  degrades to no active-window tracking rather than crashing.
- The PowerShell scripts and SMTC/WinRT projection are best-effort: written to
  the documented WinRT/PowerShell patterns but **not executed here**. They
  must be smoke-tested on a real Windows 10/11 machine (Windows PowerShell
  5.1+ or PowerShell 7) before first field use; the parsing and adapter logic
  around them is fully covered by unit tests.
- The GNOME extension's JS is linted only by Prettier (no GJS toolchain in
  CI); `gjs` syntax check and a live GNOME session remain manual steps.
- `EVENT_SOURCES` will keep growing as platforms are added; each new source is
  intentionally additive and must be paired with a categorizer state-level
  rule or the events will classify as `unknown`/`browsing_research`.
