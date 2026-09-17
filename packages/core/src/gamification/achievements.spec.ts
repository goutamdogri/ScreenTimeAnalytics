import { ACHIEVEMENTS, unlockedAchievements } from './achievements';
import type { AchievementContext } from './achievements';

const BASE: AchievementContext = {
  level: 1,
  streakDays: 0,
  focusMinutes: 0,
  wisdomMinutes: 0,
  deepWorkSessions: 0,
};

function keys(ctx: AchievementContext): string[] {
  return unlockedAchievements(ctx)
    .map((a) => a.key)
    .sort();
}

describe('achievements', () => {
  it('defines a non-empty, key-unique badge set', () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(5);
  });

  it('unlocks the first deep-work badge on the first qualifying session', () => {
    expect(keys({ ...BASE, deepWorkSessions: 1 })).toEqual(['first_deep_work']);
  });

  it('unlocks focus/wisdom milestone badges', () => {
    const ctx: AchievementContext = {
      ...BASE,
      focusMinutes: 1000,
      wisdomMinutes: 100,
      deepWorkSessions: 10,
    };
    const unlocked = keys(ctx);
    expect(unlocked).toContain('focus_100');
    expect(unlocked).toContain('focus_1000');
    expect(unlocked).toContain('wisdom_60');
    expect(unlocked).toContain('first_deep_work');
  });

  it('unlocks streak badges at their thresholds', () => {
    expect(keys({ ...BASE, streakDays: 6 })).not.toContain('streak_7');
    expect(keys({ ...BASE, streakDays: 7 })).toContain('streak_7');
    expect(keys({ ...BASE, streakDays: 30 })).toContain('streak_30');
  });

  it('unlocks level badges', () => {
    expect(keys({ ...BASE, level: 5 })).toContain('level_5');
    expect(keys({ ...BASE, level: 10 })).toContain('level_10');
  });

  it('unlocks nothing for an empty profile', () => {
    expect(keys(BASE)).toHaveLength(0);
  });
});
