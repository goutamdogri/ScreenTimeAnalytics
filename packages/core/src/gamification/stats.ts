/**
 * Four-stat model (design doc §4.1) and per-day breakdowns, all derived purely
 * from finalized `sessions`.
 *
 * - **Focus**     — deep-work session minutes.
 * - **Wisdom**    — learning session minutes.
 * - **Discipline**— one grant per active day (streak/consistency).
 * - **Restraint** — one grant per clean day (resisting autopilot).
 *
 * Stats are cumulative and never decrease, so any snapshot is stable over time
 * and "past progress is never erased" (design doc §4.2) by construction.
 */

import { Category } from '../categorization/categories';

export interface SessionForStats {
  startedAt: Date;
  category: string;
  durationMin: number;
}

/** UTC `YYYY-MM-DD` day key. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DayStat {
  date: string;
  totalMinutes: number;
  deepWorkMinutes: number;
  learningMinutes: number;
  autopilotMinutes: number;
  /** Qualifying day: a ≥20-min deep-work block or ≥30 total minutes. */
  activeDay: boolean;
  /** Clean day: did some focus-ish work and zero autopilot minutes. */
  cleanDay: boolean;
}

/** Minimum uninterrupted deep-work block that "counts" (design doc §4.2). */
export const DEEP_WORK_MIN_MINUTES = 20;
/** Minimum total screen time for a day to count as active. */
export const ACTIVE_DAY_MIN_MINUTES = 30;
/** Discipline points granted per active day. */
export const DISCIPLINE_PER_ACTIVE_DAY = 10;
/** Restraint points granted per clean day. */
export const RESTRAINT_PER_CLEAN_DAY = 10;

export interface LifetimeStats {
  focus: number;
  wisdom: number;
  discipline: number;
  restraint: number;
}

export function dayStatsByDay(sessions: SessionForStats[]): Map<string, DayStat> {
  const byDay = new Map<string, DayStat>();

  for (const session of sessions) {
    const date = dayKey(session.startedAt);
    let stat = byDay.get(date);
    if (!stat) {
      stat = {
        date,
        totalMinutes: 0,
        deepWorkMinutes: 0,
        learningMinutes: 0,
        autopilotMinutes: 0,
        activeDay: false,
        cleanDay: false,
      };
      byDay.set(date, stat);
    }
    stat.totalMinutes += session.durationMin;
    if (session.category === Category.DEEP_WORK) {
      stat.deepWorkMinutes += session.durationMin;
    } else if (session.category === Category.LEARNING) {
      stat.learningMinutes += session.durationMin;
    } else if (isAutopilot(session.category)) {
      stat.autopilotMinutes += session.durationMin;
    }
  }

  for (const stat of byDay.values()) {
    stat.activeDay =
      stat.deepWorkMinutes >= DEEP_WORK_MIN_MINUTES || stat.totalMinutes >= ACTIVE_DAY_MIN_MINUTES;
    stat.cleanDay =
      (stat.deepWorkMinutes > 0 || stat.learningMinutes > 0) && stat.autopilotMinutes === 0;
  }

  return byDay;
}

export function lifetimeStats(sessions: SessionForStats[]): LifetimeStats {
  const byDay = [...dayStatsByDay(sessions).values()];
  const focus = byDay.reduce((sum, d) => sum + d.deepWorkMinutes, 0);
  const wisdom = byDay.reduce((sum, d) => sum + d.learningMinutes, 0);
  const discipline = byDay.filter((d) => d.activeDay).length * DISCIPLINE_PER_ACTIVE_DAY;
  const restraint = byDay.filter((d) => d.cleanDay).length * RESTRAINT_PER_CLEAN_DAY;
  return { focus, wisdom, discipline, restraint };
}

export function isAutopilot(category: string): boolean {
  return (
    category === Category.SOCIAL_MEDIA ||
    category === Category.SHORT_FORM_VIDEO ||
    category === Category.LONG_FORM_VIDEO
  );
}
