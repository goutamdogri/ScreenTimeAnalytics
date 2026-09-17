import {
  dailyQuestKey,
  evaluateDailyQuest,
  generateDailyQuests,
  DEEP_WORK_TARGET_MIN,
} from './quests';
import type { DailyHistory } from './quests';

const HISTORY: DailyHistory = {
  averageDeepWorkMinutes: 42,
  yesterdayTotalMinutes: 260,
  todayTotalMinutes: 0,
  todayDeepWorkMinutes: 0,
  todayShortFormMinutes: 0,
  todayDeepWorkBlockCount: 0,
};

describe('generateDailyQuests', () => {
  it('generates the standard quest set with a personal deep-work target', () => {
    const quests = generateDailyQuests(HISTORY);
    const keys = quests.map((q) => q.key);
    expect(keys).toContain('deep_work_target');
    expect(keys).toContain('deep_work_block');
    expect(keys).toContain('no_short_form');
    expect(keys).toContain('under_yesterday');
    const target = quests.find((q) => q.key === 'deep_work_target');
    expect(target?.description).toContain('42');
  });

  it('floors the target and omits the under-yesterday quest when there is no data', () => {
    const quests = generateDailyQuests({
      ...HISTORY,
      averageDeepWorkMinutes: 3,
      yesterdayTotalMinutes: null,
    });
    expect(quests.map((q) => q.key)).not.toContain('under_yesterday');
    const target = quests.find((q) => q.key === 'deep_work_target');
    expect(target?.description).toContain(String(DEEP_WORK_TARGET_MIN));
  });
});

describe('evaluateDailyQuest', () => {
  const template = generateDailyQuests(HISTORY)[0]!;

  it('reports progress and completion for the deep-work target', () => {
    const pending = evaluateDailyQuest(template, { ...HISTORY, todayDeepWorkMinutes: 30 });
    expect(pending.progress).toBe(30);
    expect(pending.completed).toBe(false);

    const done = evaluateDailyQuest(template, { ...HISTORY, todayDeepWorkMinutes: 42 });
    expect(done.completed).toBe(true);
    expect(done.target).toBe(42);
  });

  it('completes the block quest once one 25+ minute block exists', () => {
    const { completed, progress, target } = evaluateDailyQuest(
      { ...template, key: 'deep_work_block' },
      { ...HISTORY, todayDeepWorkBlockCount: 1 },
    );
    expect(completed).toBe(true);
    expect(progress).toBe(target);
  });

  it('completes no_short_form when zero short-form minutes', () => {
    const clean = evaluateDailyQuest(
      { ...template, key: 'no_short_form' },
      { ...HISTORY, todayShortFormMinutes: 0 },
    );
    expect(clean.completed).toBe(true);
    const dirty = evaluateDailyQuest(
      { ...template, key: 'no_short_form' },
      { ...HISTORY, todayShortFormMinutes: 5 },
    );
    expect(dirty.completed).toBe(false);
  });

  it('completes under_yesterday only when today stays below yesterday', () => {
    const over = evaluateDailyQuest(
      { ...template, key: 'under_yesterday' },
      { ...HISTORY, todayTotalMinutes: 261 },
    );
    expect(over.completed).toBe(false);
    const under = evaluateDailyQuest(
      { ...template, key: 'under_yesterday' },
      { ...HISTORY, todayTotalMinutes: 259 },
    );
    expect(under.completed).toBe(true);
  });
});

describe('dailyQuestKey', () => {
  it('builds a stable per-day key', () => {
    expect(dailyQuestKey('deep_work_target', '2026-09-17')).toBe(
      'daily:deep_work_target:2026-09-17',
    );
  });
});
