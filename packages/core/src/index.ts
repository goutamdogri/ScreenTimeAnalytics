/**
 * Screen Time Analytics — core business logic.
 *
 * This package will hold the pure, database-free business rules used by the
 * backend engine: content categorization (rule + LLM layers), intentionality
 * scoring, and the XP/quest gamification math (Phases 3 & 5).
 *
 * Kept independent from any app/framework so everything here is unit-testable
 * without a database, a browser, or a real LLM call.
 */

/**
 * Top-level content categories (design doc §3.1).
 *
 * Defined here now because the rule/whitelist mapping layer, the backend
 * classification pipeline, and the dashboard all rely on one canonical set.
 */
export enum Category {
  DEEP_WORK = 'deep_work',
  LEARNING = 'learning',
  SOCIAL_MEDIA = 'social_media',
  SHORT_FORM_VIDEO = 'short_form_video',
  LONG_FORM_VIDEO = 'long_form_video',
  MUSIC_AUDIO = 'music_audio',
  COMMUNICATION = 'communication',
  BROWSING_RESEARCH = 'browsing_research',
  IDLE_AFK = 'idle_afk',
  OTHER = 'other',
}

/**
 * Long-form video sub-categories (design doc §3.2.1).
 */
export enum LongFormVideoSubCategory {
  EDUCATIONAL_TUTORIAL = 'educational_tutorial',
  DOCUMENTARY = 'documentary',
  TECH_REVIEW = 'tech_review',
  ENTERTAINMENT_COMEDY = 'entertainment_comedy',
  VLOG_LIFESTYLE = 'vlog_lifestyle',
  NEWS_COMMENTARY = 'news_commentary',
  PODCAST_TALK = 'podcast_talk',
  MUSIC_LONG_FORM = 'music_long_form',
  OTHER = 'other',
}

export const CORE_VERSION = '0.1.0';

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
