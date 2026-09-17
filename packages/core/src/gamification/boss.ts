/**
 * Weekly boss fight (design doc §4.3/§4.5): an aggregate weekly target drawn
 * from the user's own recent weeks ("vs. your past self"), whose HP drains as
 * the week's focus accumulates. Defeating it grants weekly bonus XP.
 */

/**
 * Floor so a brand-new user's first boss isn't trivially set to ~0 minutes.
 * Tunable once real usage data exists (design doc §4.2 tuning posture).
 */
export const WEEKLY_BOSS_MIN_TARGET_MIN = 180;
export const WEEKLY_BOSS_REWARD_XP = 200;

/** Target = rounded mean of prior full weeks' focus minutes, floored. */
export function weeklyBossTarget(priorWeeklyFocusMinutes: number[]): number {
  const relevant = priorWeeklyFocusMinutes.slice(0, 4);
  if (relevant.length === 0) {
    return WEEKLY_BOSS_MIN_TARGET_MIN;
  }
  const mean = relevant.reduce((sum, m) => sum + m, 0) / relevant.length;
  return Math.max(WEEKLY_BOSS_MIN_TARGET_MIN, Math.round(mean));
}

export interface BossProgress {
  focusMinutes: number;
  target: number;
  /** 100 down to 0 as the week's focus closes in on the target. */
  hp: number;
  defeated: boolean;
}

export function bossProgress(thisWeekFocusMinutes: number, target: number): BossProgress {
  const defeated = thisWeekFocusMinutes >= target;
  const ratio = target > 0 ? Math.min(1, thisWeekFocusMinutes / target) : 0;
  return {
    focusMinutes: thisWeekFocusMinutes,
    target,
    hp: Math.max(0, Math.round(100 * (1 - ratio))),
    defeated,
  };
}
