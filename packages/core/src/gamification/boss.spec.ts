import { bossProgress, weeklyBossTarget, WEEKLY_BOSS_MIN_TARGET_MIN } from './boss';

describe('weeklyBossTarget', () => {
  it('floors at the minimum target for new users', () => {
    expect(weeklyBossTarget([])).toBe(WEEKLY_BOSS_MIN_TARGET_MIN);
  });

  it('uses the mean of the last four full weeks', () => {
    const weeks = [400, 200, 0, 800, 9999];
    // mean of the first four: (400 + 200 + 0 + 800) / 4 = 350
    expect(weeklyBossTarget(weeks)).toBe(350);
  });

  it('never drops below the floor', () => {
    expect(weeklyBossTarget([10, 5])).toBe(WEEKLY_BOSS_MIN_TARGET_MIN);
  });
});

describe('bossProgress', () => {
  it('drains HP as the week focuses and defeats at the target', () => {
    expect(bossProgress(90, 180)).toEqual({
      focusMinutes: 90,
      target: 180,
      hp: 50,
      defeated: false,
    });
    expect(bossProgress(179, 180)).toEqual({
      focusMinutes: 179,
      target: 180,
      hp: 1,
      defeated: false,
    });
    expect(bossProgress(180, 180)).toEqual({
      focusMinutes: 180,
      target: 180,
      hp: 0,
      defeated: true,
    });
    expect(bossProgress(400, 180).defeated).toBe(true);
    expect(bossProgress(0, 180).hp).toBe(100);
  });
});
