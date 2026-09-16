/**
 * Capture logic for the MV3 extension (design doc §7.5).
 *
 * The extension only observes the active tab; it never reads history or other
 * tabs, and it only reacts to explicit activation/url changes. UI-internal
 * pages (chrome://, edge://, file://) and empty states are skipped so they
 * never produce events.
 */

/** The desktop agent's loopback event endpoint. */
export const LOCAL_AGENT_EVENT_URL = 'http://127.0.0.1:8765/event';

export interface CapturePayload {
  url: string;
  title?: string;
}

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Turns a Chrome tab into a capture payload, or `null` when the tab has no
 * capturable web page (internal pages, about:, blank new tabs).
 */
export function buildCapturePayload(tab: chrome.tabs.Tab | undefined): CapturePayload | null {
  const url = tab?.url ?? '';
  if (!HTTP_URL_RE.test(url)) {
    return null;
  }
  const title = tab?.title?.trim() || undefined;
  return { url, title };
}

export interface CaptureSchedulerDeps {
  /** Invoked with the final, settled payload after the debounce elapses. */
  onCapture: (payload: CapturePayload) => void;
  delayMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

/**
 * Debounces rapid tab churn so a history.push through several url changes
 * reports one settled page instead of a burst of identical events. The agent's
 * local server dedupes anyway; this just keeps the wire quiet.
 */
export function createCaptureScheduler(deps: CaptureSchedulerDeps) {
  const delayMs = deps.delayMs ?? 1200;
  const setTimer = deps.setTimeoutFn ?? setTimeout;
  const clearTimer = deps.clearTimeoutFn ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function schedule(payload: CapturePayload | null): void {
    if (payload === null) {
      return;
    }
    if (timer !== null) {
      clearTimer(timer);
    }
    timer = setTimer(() => {
      timer = null;
      deps.onCapture(payload);
    }, delayMs);
  };
}
