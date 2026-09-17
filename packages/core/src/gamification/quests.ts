/**
 * Quest engine (design doc §4.3): daily quests auto-generated from personal
 * usage patterns, plus pure evaluation of live progress against those targets.
 *
 * Generation is deterministic per user/day — the same history produces the same
 * quests — so re-runs never duplicate a quest row (the backend keys on
 * `(user, key, period)`).
 */

export interface DailyHistory {
  /** Rolling average deep-work minutes (e.g. across the last 7 days). */
  averageDeepWorkMinutes: number;
  /** Total minutes yesterday (`null` when there is no yesterday data). */
  yesterdayTotalMinutes: number | null;
  /** Live totals for today. */
  todayTotalMinutes: number;
  todayDeepWorkMinutes: number;
  todayShortFormMinutes: number;
  /** Whether today already contains one ≥25-minute deep-work block. */
  todayDeepWorkBlockCount: number;
}

export interface QuestTemplate {
  key: string;
  title: string;
  description: string;
  rewardXp: number;
}

export interface QuestProgress {
  key: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardXp: number;
}

export const DEEP_WORK_TARGET_MIN = 20;

export function generateDailyQuests(history: DailyHistory): QuestTemplate[] {
  const deepWorkTarget = Math.max(DEEP_WORK_TARGET_MIN, Math.ceil(history.averageDeepWorkMinutes));

  const quests: QuestTemplate[] = [
    {
      key: 'deep_work_target',
      title: 'Deep work target',
      description: `Reach ${deepWorkTarget} minutes of deep work today`,
      rewardXp: 40,
    },
    {
      key: 'deep_work_block',
      title: 'One solid block',
      description: 'Complete a focused block of 25 uninterrupted minutes',
      rewardXp: 25,
    },
    {
      key: 'no_short_form',
      title: 'No doomscroll',
      description: 'Zero short-form video minutes today',
      rewardXp: 20,
    },
  ];

  if (history.yesterdayTotalMinutes !== null) {
    quests.push({
      key: 'under_yesterday',
      title: 'Do less than yesterday',
      description: `Finish the day under ${history.yesterdayTotalMinutes} minutes`,
      rewardXp: 15,
    });
  }

  return quests;
}

export function evaluateDailyQuest(template: QuestTemplate, history: DailyHistory): QuestProgress {
  switch (template.key) {
    case 'deep_work_target': {
      const target = Math.max(DEEP_WORK_TARGET_MIN, Math.ceil(history.averageDeepWorkMinutes));
      const progress = Math.min(history.todayDeepWorkMinutes, target);
      return {
        key: template.key,
        progress,
        target,
        completed: history.todayDeepWorkMinutes >= target,
        rewardXp: template.rewardXp,
      };
    }
    case 'deep_work_block': {
      const progress = Math.min(history.todayDeepWorkBlockCount, 1);
      return {
        key: template.key,
        progress,
        target: 1,
        completed: history.todayDeepWorkBlockCount >= 1,
        rewardXp: template.rewardXp,
      };
    }
    case 'no_short_form': {
      const progress = history.todayShortFormMinutes === 0 ? 1 : 0;
      return {
        key: template.key,
        progress,
        target: 1,
        completed: history.todayShortFormMinutes === 0,
        rewardXp: template.rewardXp,
      };
    }
    case 'under_yesterday': {
      const target = history.yesterdayTotalMinutes ?? 0;
      const progress = Math.min(history.todayTotalMinutes, target);
      return {
        key: template.key,
        progress,
        target,
        completed: target > 0 && history.todayTotalMinutes < target,
        rewardXp: template.rewardXp,
      };
    }
    default:
      return {
        key: template.key,
        progress: 0,
        target: 1,
        completed: false,
        rewardXp: template.rewardXp,
      };
  }
}

/** Stable per-day quest key used by the persistence layer for idempotency. */
export function dailyQuestKey(key: string, date: string): string {
  return `daily:${key}:${date}`;
}
