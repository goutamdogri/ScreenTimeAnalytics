# Screen Time Analytics — Browser Extension (MV3)

A minimal Chrome/Edge Manifest V3 extension that reports the active tab to the
local desktop agent for content categorization (design doc §7.5).

## How it works

- `src/background.ts` subscribes to `tabs.onActivated` and `tabs.onUpdated`.
- The active tab is turned into `{ url, title }` by `buildCapturePayload`
  (`src/capture.ts`). Internal pages (`chrome://`, `about:`, `file://`) are
  skipped.
- Tab churn is debounced (~1.2s) so a settled page is reported once.
- The payload is POSTed to the desktop agent's loopback endpoint
  `http://127.0.0.1:8765/event` (agent offline is silently tolerated and retried
  on the next tab change).

## Load it in Chrome

1. `pnpm build` — emits `dist/background.js` + `dist/capture.js`.
2. Chrome → Extensions → enable **Developer mode** → **Load unpacked** → select
   this folder (`apps/extension`).
3. Keep the desktop agent running (`pnpm --filter @screen-time/desktop-agent dev`).

## Build & checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```
