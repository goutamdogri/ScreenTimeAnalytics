/**
 * Session derivation — the 5-minute gap rule that turns a clock of `raw_events`
 * into focus sessions (design doc §6 `sessions`).
 *
 * Pure and deterministic: give it the same rows and the same `now` and it
 * produces the same windows. The backend's `SessionFinalizerWorker` owns the
 * database and the clock; this module owns the grouping math, so both the
 * dashboard and the gamification engine consume identical session shapes.
 */

export const SESSION_GAP_MS = 5 * 60 * 1000;

/** Minimal shape the finalizer needs from a raw focus event. */
export interface SessionInputRow {
  timestamp: Date;
  app: string | null;
  windowTitle: string | null;
  category: string;
  subCategory?: string | null;
  source: string;
}

export interface DerivedSession {
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  app: string | null;
  windowTitle: string | null;
  category: string;
  subCategory: string | null;
  source: string;
  appMinutes: Record<string, number>;
}

/** A not-yet-closed window the finalizer keeps accumulating (its cursor). */
export interface SessionWindow {
  startedAt: Date;
  endedAt: Date;
  events: SessionInputRow[];
}

/** Persisted form of the open cursor (JSON column on the `sessions` row). */
export interface PendingEventSnapshot {
  t: string;
  app: string | null;
  title: string | null;
  cat: string;
  sub: string | null;
  src: string;
}

export interface DeriveSessionsResult {
  /** Windows whose following gap is confirmed (or whose silence ≥ gap at `now`). */
  closed: DerivedSession[];
  /** The trailing window still plausibly running — retry next tick. */
  open: SessionWindow | null;
}

/**
 * Derives sessions from a stream of events (used by the backfill path).
 *
 * A window closes when the gap to the next event exceeds {@link SESSION_GAP_MS},
 * or — for the trailing window — when `now - endedAt >= SESSION_GAP_MS`, i.e.
 * a confirmed 5-minute silence. The trailing window that isn't yet silent is
 * returned as `open` so a later tick can extend or close it.
 */
export function deriveSessions(events: SessionInputRow[], now: Date): DeriveSessionsResult {
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const closed: DerivedSession[] = [];
  let open: SessionWindow | null = null;

  for (const event of sorted) {
    if (open === null) {
      open = { startedAt: event.timestamp, endedAt: event.timestamp, events: [event] };
      continue;
    }
    if (appendToWindow(open, event) === 'merged') {
      continue;
    }
    closed.push(finalizeWindow(open));
    open = { startedAt: event.timestamp, endedAt: event.timestamp, events: [event] };
  }

  if (open !== null && now.getTime() - open.endedAt.getTime() >= SESSION_GAP_MS) {
    closed.push(finalizeWindow(open));
    open = null;
  }

  return { closed, open };
}

/**
 * Merges a new event into the open cursor, or reports the window as closed.
 *
 * Merging extends the window both forward (newer events) and backward (late,
 * out-of-order events within the gap). A gap of more than {@link SESSION_GAP_MS}
 * means the previous window is finished.
 */
export function appendToWindow(window: SessionWindow, event: SessionInputRow): 'merged' | 'closed' {
  const gap = event.timestamp.getTime() - window.endedAt.getTime();
  if (gap <= SESSION_GAP_MS) {
    if (event.timestamp.getTime() > window.endedAt.getTime()) {
      window.endedAt = event.timestamp;
    }
    if (event.timestamp.getTime() < window.startedAt.getTime()) {
      window.startedAt = event.timestamp;
    }
    window.events.push(event);
    return 'merged';
  }
  return 'closed';
}

/** Whether the window's trailing silence has exceeded the 5-minute gap. */
export function isWindowClosed(window: SessionWindow, now: Date): boolean {
  return now.getTime() - window.endedAt.getTime() >= SESSION_GAP_MS;
}

export function finalizeWindow(window: SessionWindow): DerivedSession {
  const first = window.events[0];
  const last = window.events[window.events.length - 1];
  if (!first || !last) {
    throw new Error('finalizeWindow called with an empty window');
  }
  const spanMs = last.timestamp.getTime() - first.timestamp.getTime();
  return {
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    durationMin: Math.max(1, Math.round(spanMs / 60000)),
    app: mode(window.events.map((e) => e.app)),
    windowTitle: mode(window.events.map((e) => e.windowTitle)),
    category: mode(window.events.map((e) => e.category)) ?? 'other',
    subCategory: mode(window.events.map((e) => e.subCategory ?? null)),
    source: mode(window.events.map((e) => e.source)) ?? 'x11',
    appMinutes: distinctMinutesPerApp(window.events),
  };
}

/** Snapshots the open cursor so it survives worker restarts (JSON-safe). */
export function sessionWindowToSnapshot(window: SessionWindow): PendingEventSnapshot[] {
  return window.events.map((e) => ({
    t: e.timestamp.toISOString(),
    app: e.app,
    title: e.windowTitle,
    cat: e.category,
    sub: e.subCategory ?? null,
    src: e.source,
  }));
}

/** Rebuilds an open cursor from a persisted snapshot. */
export function sessionWindowFromSnapshot(snapshot: PendingEventSnapshot[]): SessionWindow {
  const events: SessionInputRow[] = snapshot.map((s) => ({
    timestamp: new Date(s.t),
    app: s.app,
    windowTitle: s.title,
    category: s.cat,
    subCategory: s.sub,
    source: s.src,
  }));
  if (events.length === 0) {
    throw new Error('sessionWindowFromSnapshot called with an empty snapshot');
  }
  const first = events[0]!;
  const last = events[events.length - 1]!;
  return {
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    events,
  };
}

function mode(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

/** Distinct-minute counts per app — mirrors `COUNT(DISTINCT minute)` semantics. */
function distinctMinutesPerApp(events: SessionInputRow[]): Record<string, number> {
  const perApp = new Map<string, Set<number>>();
  for (const event of events) {
    if (!event.app) continue;
    let set = perApp.get(event.app);
    if (!set) {
      set = new Set<number>();
      perApp.set(event.app, set);
    }
    set.add(Math.floor(event.timestamp.getTime() / 60000));
  }
  const result: Record<string, number> = {};
  for (const [app, set] of perApp) {
    result[app] = set.size;
  }
  return result;
}
