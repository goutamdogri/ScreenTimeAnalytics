/**
 * Canonical event contracts shared across the backend and the agent (design
 * doc §6 `raw_events`). Kept in `core` because both sides validate against it,
 * and the categorization pipeline consumes these same shapes.
 */

/**
 * Canonical origin of a raw activity event (design doc §6 `raw_events.source`).
 *
 * `x11` = active-window focus/state captured by the X11 adapter, `mpris` =
 * now-playing media from MPRIS, `extension` = browser tab browse events posted
 * to the agent's localhost server. The backend validates ingestion against this
 * set, so it lives here (pure core) rather than in the backend or agent.
 */
export const EVENT_SOURCES = ['x11', 'mpris', 'extension'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/**
 * Canonical kind of a raw activity event (§6 `raw_events.event_type`).
 *
 * `focus` = the foreground window changed, `idle` = AFK state toggled, `media` =
 * now-playing metadata changed, `browse` = a browser tab was active.
 */
export const EVENT_TYPES = ['focus', 'idle', 'media', 'browse'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * The payload shape an agent sends for one observation, shared by the agent's
 * ingest client and the backend's `POST /events` DTO (design doc §2.6).
 */
export interface RawEventPayload {
  timestamp: string;
  source: EventSource;
  eventType: EventType;
  app?: string;
  windowTitle?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}
