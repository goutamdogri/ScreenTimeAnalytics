import {
  coinsForLevel,
  cumulativeXpForLevel,
  levelForXp,
  totalCoinsForLevel,
  xpForLevel,
  xpProgress,
} from './levels';

describe('levels', () => {
  it('applies the 100 × N^1.5 curve', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(283);
    expect(xpForLevel(3)).toBe(520);
  });

  it('computes cumulative thresholds', () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(383);
  });

  it('maps XP to levels at the boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(382)).toBe(2);
    expect(levelForXp(383)).toBe(3);
  });

  it('reports in-level progress', () => {
    const atStart = xpProgress(383); // just reached level 3
    expect(atStart.level).toBe(3);
    expect(atStart.inLevel).toBe(0);
    expect(atStart.forNextLevel).toBe(520);
    expect(atStart.progress).toBe(0);

    const halfway = xpProgress(383 + 260);
    expect(halfway.inLevel).toBe(260);
    expect(halfway.progress).toBeCloseTo(0.5);
  });

  it('grants coins only on level-ups after level 1', () => {
    expect(coinsForLevel(2)).toBe(2);
    expect(totalCoinsForLevel(1)).toBe(0);
    expect(totalCoinsForLevel(3)).toBe(2 + 3);
    expect(totalCoinsForLevel(5)).toBe(2 + 3 + 4 + 5);
  });
});
