import { Category } from '../categorization/categories';
import {
  dayStatsByDay,
  DISCIPLINE_PER_ACTIVE_DAY,
  lifetimeStats,
  RESTRAINT_PER_CLEAN_DAY,
} from './stats';
import type { SessionForStats } from './stats';

function session(
  day: number,
  minutesAgoFromNoon: number,
  category: string,
  durationMin: number,
): SessionForStats {
  return {
    startedAt: new Date(Date.UTC(2026, 8, day, 12, 0, 0) + minutesAgoFromNoon * 60_000),
    category,
    durationMin,
  };
}

describe('dayStatsByDay', () => {
  it('buckets sessions into UTC days with category minutes', () => {
    const byDay = dayStatsByDay([
      session(16, 0, Category.DEEP_WORK, 25),
      session(16, -30, Category.LEARNING, 15),
      session(17, 0, Category.SOCIAL_MEDIA, 40),
    ]);
    expect(byDay.get('2026-09-16')).toMatchObject({
      deepWorkMinutes: 25,
      learningMinutes: 15,
      totalMinutes: 40,
      activeDay: true,
    });
    expect(byDay.get('2026-09-17')).toMatchObject({
      autopilotMinutes: 40,
      activeDay: true,
      cleanDay: false,
    });
  });

  it('a focused day with no autopilot is a clean day', () => {
    const byDay = dayStatsByDay([session(16, 0, Category.DEEP_WORK, 30)]);
    expect(byDay.get('2026-09-16')?.cleanDay).toBe(true);
  });

  it('an autopilot-only day is neither active-for-discipline nor clean', () => {
    const byDay = dayStatsByDay([session(16, 0, Category.SHORT_FORM_VIDEO, 60)]);
    expect(byDay.get('2026-09-16')).toMatchObject({ activeDay: true, cleanDay: false });
  });
});

describe('lifetimeStats', () => {
  it('sums focus/wisdom minutes and per-day discipline/restraint points', () => {
    const stats = lifetimeStats([
      session(15, 0, Category.DEEP_WORK, 22),
      session(15, -60, Category.LONG_FORM_VIDEO, 10),
      session(16, 0, Category.DEEP_WORK, 25), // clean active day
      session(17, 0, Category.LEARNING, 30), // clean active day
      session(18, 0, Category.MUSIC_AUDIO, 5), // not active, not clean
    ]);
    expect(stats.focus).toBe(22 + 25);
    expect(stats.wisdom).toBe(30);
    expect(stats.discipline).toBe(3 * DISCIPLINE_PER_ACTIVE_DAY);
    // Day 15 has autopilot minutes → not clean. Days 16 and 17 are clean.
    expect(stats.restraint).toBe(2 * RESTRAINT_PER_CLEAN_DAY);
  });
});
