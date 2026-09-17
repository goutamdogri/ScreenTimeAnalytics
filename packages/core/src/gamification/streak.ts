/**
 * Streak mechanics (design doc §4.1/§4.2): consecutive "active days" drive the
 * Discipline stat and the XP streak multiplier.
 *
 * An active day is one with a qualifying deep-work block or meaningful total
 * screen time — see {@link ACTIVE_DAY_MIN_MINUTES} and the `activeDay` rule in
 * `stats.ts`. Breaking a streak never deducts XP; the multiplier simply resets
 * to 1.0× (design doc §4.2 — "no XP deduction for bad days").
 */

export const ANCHOR_MS = 24 * 60 * 60 * 1000;

/**
 * Streak multiplier: grows 1.0× → 2.0× linearly over 30 streak days and is
 * capped at 2.0 (design doc §4.2).
 */
export function streakMultiplier(streakDays: number): number {
  return Math.min(2, Math.max(1, 1 + streakDays / 30));
}

export interface StreakDay {
  /** UTC `YYYY-MM-DD`. */
  date: string;
  activeDay: boolean;
}

function dayBefore(date: string): string {
  const ms = new Date(`${date}T00:00:00.000Z`).getTime() - ANCHOR_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Counts consecutive active days ending at `date` (used for computing the XP
 * multiplier at the moment a specific session's day closed).
 */
export function streakOnDay(days: StreakDay[], date: string): number {
  const active = new Map(days.map((d) => [d.date, d.activeDay]));
  let cursor = date;
  let streak = 0;
  while (active.get(cursor)) {
    streak += 1;
    cursor = dayBefore(cursor);
  }
  return streak;
}

/**
 * Counts consecutive active days ending today (or yesterday if today is not yet
 * active, so an in-progress day never silently breaks the chain).
 */
export function currentStreak(days: StreakDay[], now: Date): number {
  const active = new Map(days.map((d) => [d.date, d.activeDay]));
  const today = now.toISOString().slice(0, 10);
  const anchor = active.get(today) ? today : dayBefore(today);
  return streakOnDay(days, anchor);
}
