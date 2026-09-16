import type { RawEventPayload } from '@screen-time/core';
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
 */
export function focusEvent(timestamp: string, window: ActiveWindowInfo): RawEventPayload {
  return {
    timestamp,
    source: 'x11',
    eventType: 'focus',
    app: window.processName,
    windowTitle: window.title,
  };
}

export function idleEvent(timestamp: string, idle: boolean): RawEventPayload {
  return {
    timestamp,
    source: 'x11',
    eventType: 'idle',
    app: 'system',
    metadata: { idle },
  };
}

export function mediaEvent(timestamp: string, np: NowPlayingInfo | null): RawEventPayload {
  if (np === null) {
    return {
      timestamp,
      source: 'mpris',
      eventType: 'media',
      app: 'system',
      metadata: { state: 'stopped' },
    };
  }
  return {
    timestamp,
    source: 'mpris',
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
  const meta: Record<string, unknown> = { url: input.url };
  if (input.title) meta.title = input.title;
  return {
    timestamp: input.timestamp,
    source: 'extension',
    eventType: 'browse',
    app: 'browser',
    metadata: meta,
  };
}
