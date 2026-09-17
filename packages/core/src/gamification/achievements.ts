/**
 * One-time achievement badges (design doc §4.3). Defined declaratively here so
 * the backend (and future UIs) share a single source of truth. All conditions
 * are pure functions of a snapshot (level, streak, minutes) — no hidden state.
 */

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  rewardXp: number;
}

export interface AchievementContext {
  level: number;
  streakDays: number;
  focusMinutes: number;
  wisdomMinutes: number;
  deepWorkSessions: number;
}

const DEFS: readonly AchievementDef[] = [
  {
    key: 'first_deep_work',
    title: 'First deep block',
    description: 'Complete one 20-minute deep-work session',
    rewardXp: 10,
  },
  {
    key: 'focus_100',
    title: 'Pace setter',
    description: 'Accumulate 100 minutes of deep work',
    rewardXp: 10,
  },
  {
    key: 'focus_1000',
    title: 'Focus machine',
    description: 'Accumulate 1000 minutes of deep work',
    rewardXp: 10,
  },
  {
    key: 'wisdom_60',
    title: 'Lifelong learner',
    description: 'Accumulate 60 minutes of learning',
    rewardXp: 10,
  },
  {
    key: 'streak_3',
    title: 'Starter streak',
    description: 'Stay active 3 days in a row',
    rewardXp: 10,
  },
  {
    key: 'streak_7',
    title: 'Week streak',
    description: 'Stay active 7 days in a row',
    rewardXp: 10,
  },
  {
    key: 'streak_30',
    title: 'Month streak',
    description: 'Stay active 30 days in a row',
    rewardXp: 10,
  },
  {
    key: 'level_5',
    title: 'Level 5',
    description: 'Reach level 5',
    rewardXp: 10,
  },
  {
    key: 'level_10',
    title: 'Level 10',
    description: 'Reach level 10',
    rewardXp: 10,
  },
];

export const ACHIEVEMENTS: readonly AchievementDef[] = DEFS;

/** All achievements whose condition is met by the given snapshot. */
export function unlockedAchievements(ctx: AchievementContext): AchievementDef[] {
  return DEFS.filter((def) => conditionMet(def.key, ctx));
}

function conditionMet(key: string, ctx: AchievementContext): boolean {
  switch (key) {
    case 'first_deep_work':
      return ctx.deepWorkSessions >= 1;
    case 'focus_100':
      return ctx.focusMinutes >= 100;
    case 'focus_1000':
      return ctx.focusMinutes >= 1000;
    case 'wisdom_60':
      return ctx.wisdomMinutes >= 60;
    case 'streak_3':
      return ctx.streakDays >= 3;
    case 'streak_7':
      return ctx.streakDays >= 7;
    case 'streak_30':
      return ctx.streakDays >= 30;
    case 'level_5':
      return ctx.level >= 5;
    case 'level_10':
      return ctx.level >= 10;
    default:
      return false;
  }
}
