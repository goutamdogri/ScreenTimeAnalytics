/**
 * XP math (design doc §4.2, §8.1 business rules).
 *
 * Base XP per qualifying closed session — Deep Work needs a minimum
 * uninterrupted length (≥20 min) to prevent "farming", Learning ≥15 min — then
 * scaled by the day's streak multiplier. No negative awards exist: a session
 * either earns XP or earns none.
 */

import { Category } from '../categorization/categories';

export interface SessionXpInput {
  category: string;
  durationMin: number;
}

export interface SessionXpRule {
  category: string;
  /** Minimum session length for it to earn XP (design doc §4.2 anti-farming). */
  minMinutes: number;
  /** Base XP at 1.0× multiplier. */
  xp: number;
}

export const SESSION_XP_RULES: readonly SessionXpRule[] = [
  { category: Category.DEEP_WORK, minMinutes: 20, xp: 25 },
  { category: Category.LEARNING, minMinutes: 15, xp: 15 },
];

export function baseXpForSession(session: SessionXpInput): number {
  for (const rule of SESSION_XP_RULES) {
    if (session.category === rule.category && session.durationMin >= rule.minMinutes) {
      return rule.xp;
    }
  }
  return 0;
}

/** Final award for a closing session: base XP scaled by the streak multiplier. */
export function xpForClose(baseXp: number, multiplier: number): number {
  return Math.round(baseXp * multiplier);
}

/** Which stat axis a qualifying session feeds (design doc §4.1). */
export function statForCategory(category: string): 'focus' | 'wisdom' | null {
  if (category === Category.DEEP_WORK) return 'focus';
  if (category === Category.LEARNING) return 'wisdom';
  return null;
}
