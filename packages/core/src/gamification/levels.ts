/**
 * Level curve (design doc §4.2): XP for level `N` = `100 × N^1.5` (rounded).
 *
 * All numbers in this module are pure functions of XP — there is no stored
 * "level" that can drift from the XP log.
 */

export const LEVEL_XP_BASE = 100;
export const LEVEL_XP_EXPONENT = 1.5;

/** XP required to advance *from* level `N` to `N + 1` (design doc §4.2). */
export function xpForLevel(level: number): number {
  return Math.round(LEVEL_XP_BASE * Math.pow(level, LEVEL_XP_EXPONENT));
}

/** Cumulative XP required to *reach* `level` (level 1 needs 0). */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n += 1) {
    total += xpForLevel(n);
  }
  return total;
}

/** The highest level whose cumulative threshold is met. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp) {
    level += 1;
  }
  return level;
}

export interface XpProgress {
  level: number;
  xp: number;
  /** XP earned inside the current level. */
  inLevel: number;
  /** XP needed to reach the next level. */
  forNextLevel: number;
  /** 0–1 progress through the current level. */
  progress: number;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const inLevel = Math.max(0, xp - cumulativeXpForLevel(level));
  const forNextLevel = xpForLevel(level);
  return {
    level,
    xp,
    inLevel,
    forNextLevel,
    progress: forNextLevel > 0 ? Math.min(1, inLevel / forNextLevel) : 1,
  };
}

/**
 * Focus Coins (design doc §4.4): crossing into level `N` grants `N` coins.
 * Cosmetic-only currency; computed deterministically from the level so no
 * incremental coin bookkeeping can drift.
 */
export function coinsForLevel(level: number): number {
  return Math.max(0, level);
}

/** Total coins a player has at `level` (sum of all level-up grants so far). */
export function totalCoinsForLevel(level: number): number {
  let total = 0;
  for (let n = 2; n <= level; n += 1) {
    total += coinsForLevel(n);
  }
  return total;
}
