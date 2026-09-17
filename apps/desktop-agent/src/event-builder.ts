import type { EventSource, RawEventPayload } from '@screen-time/core';
import type { ActiveWindowInfo, NowPlayingInfo } from '@screen-time/adapters';

/**
 * Adapter observables → ingestion payloads (§6 event contracts).
 *
 * Each event carries at minimum:
 *  - `timestamp` (ISO-8601, the exact moment the thing being recorded happened)
 *  - `source` + `eventType` + `app` (what is being recorded)
 *
 * The device is identified by the backend from the `x-device-token` header at
 * ingest time; the `(deviceId, timestamp, source)` unique triple is what
 * makes the backend's ingest idempotent.
 *
 * `source` identifies the OS path an observation came from (`x11`, `wayland`,
 * `windows`, `mpris`, `smtc`); the runtime threads the active adapter's own
 * source label through.
 */
export function focusEvent(
  timestamp: string,
  window: ActiveWindowInfo,
  source: EventSource = 'x11',
): RawEventPayload {
  return {
    timestamp,
    source,
    eventType: 'focus',
    app: window.processName,
    windowTitle: window.title,
  };
}

export function idleEvent(
  timestamp: string,
  idle: boolean,
  source: EventSource = 'x11',
): RawEventPayload {
  return {
    timestamp,
    source,
    eventType: 'idle',
    app: 'system',
    metadata: { idle },
  };
}

export function mediaEvent(
  timestamp: string,
  np: NowPlayingInfo | null,
  source: EventSource = 'mpris',
): RawEventPayload {
  if (np === null) {
    return {
      timestamp,
      source,
      eventType: 'media',
      app: 'system',
      metadata: { state: 'stopped' },
    };
  }
  return {
    timestamp,
    source,
    eventType: 'media',
    app: np.sourceApp,
    windowTitle: np.trackTitle,
    metadata: { artist: np.artist, durationSeconds: np.durationSeconds },
  };
}

export interface BrowseEventInput {
  url: string;
  title?: string;
  timestamp: string;
}

export function browseEvent(input: BrowseEventInput): RawEventPayload {
  // Top-level `url`/`windowTitle` drive the backend categorization pipeline;
  // `metadata` stays for backward-compatible legacy readers.
  const meta: Record<string, unknown> = { url: input.url };
  if (input.title) meta.title = input.title;
  return {
    timestamp: input.timestamp,
    source: 'extension',
    eventType: 'browse',
    app: 'browser',
    url: input.url,
    windowTitle: input.title,
    metadata: meta,
  };
}
