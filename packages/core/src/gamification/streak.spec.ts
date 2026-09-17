import { currentStreak, streakMultiplier, streakOnDay } from './streak';

describe('streakMultiplier', () => {
  it('scales 1.0 → 2.0 over 30 days and caps at 2.0', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(15)).toBeCloseTo(1.5);
    expect(streakMultiplier(30)).toBe(2);
    expect(streakMultiplier(60)).toBe(2);
  });

  it('never dips below 1.0 (broken streak resets, no XP deduction)', () => {
    expect(streakMultiplier(-5)).toBe(1);
  });
});

describe('streakOnDay', () => {
  const days = [
    { date: '2026-09-14', activeDay: true },
    { date: '2026-09-15', activeDay: true },
    { date: '2026-09-16', activeDay: false },
    { date: '2026-09-17', activeDay: true },
  ];

  it('counts back from a given day, stopping at the first inactive day', () => {
    expect(streakOnDay(days, '2026-09-15')).toBe(2);
    expect(streakOnDay(days, '2026-09-17')).toBe(1);
    expect(streakOnDay(days, '2026-09-16')).toBe(0);
    expect(streakOnDay(days, '2026-09-13')).toBe(0);
  });
});

describe('currentStreak', () => {
  const now = new Date('2026-09-17T14:00:00.000Z');

  it('counts consecutive active days ending today', () => {
    const days = ['2026-09-15', '2026-09-16', '2026-09-17'].map((date) => ({
      date,
      activeDay: true,
    }));
    expect(currentStreak(days, now)).toBe(3);
  });

  it('counts from yesterday when today is not yet active', () => {
    const days = ['2026-09-15', '2026-09-16'].map((date) => ({ date, activeDay: true }));
    expect(currentStreak(days, now)).toBe(2);
  });

  it('stops at the first inactive day', () => {
    const days = [
      { date: '2026-09-14', activeDay: true },
      { date: '2026-09-15', activeDay: false },
      { date: '2026-09-16', activeDay: true },
      { date: '2026-09-17', activeDay: true },
    ];
    expect(currentStreak(days, now)).toBe(2);
  });

  it('returns 0 when there is no active day', () => {
    expect(currentStreak([{ date: '2026-09-17', activeDay: false }], now)).toBe(0);
  });
});
