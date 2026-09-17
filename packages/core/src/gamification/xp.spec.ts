import { Category } from '../categorization/categories';
import { baseXpForSession, statForCategory, xpForClose } from './xp';

describe('baseXpForSession', () => {
  it('requires 20 uninterrupted minutes for deep work (anti-farming)', () => {
    expect(baseXpForSession({ category: Category.DEEP_WORK, durationMin: 19 })).toBe(0);
    expect(baseXpForSession({ category: Category.DEEP_WORK, durationMin: 20 })).toBe(25);
    expect(baseXpForSession({ category: Category.DEEP_WORK, durationMin: 60 })).toBe(25);
  });

  it('requires 15 minutes for learning', () => {
    expect(baseXpForSession({ category: Category.LEARNING, durationMin: 14 })).toBe(0);
    expect(baseXpForSession({ category: Category.LEARNING, durationMin: 15 })).toBe(15);
  });

  it('pays nothing for non-focus categories', () => {
    expect(baseXpForSession({ category: Category.MUSIC_AUDIO, durationMin: 120 })).toBe(0);
    expect(baseXpForSession({ category: Category.SOCIAL_MEDIA, durationMin: 90 })).toBe(0);
  });
});

describe('xpForClose', () => {
  it('scales base XP by the streak multiplier and rounds', () => {
    expect(xpForClose(25, 1)).toBe(25);
    expect(xpForClose(25, 1.5)).toBe(38);
    expect(xpForClose(25, 2)).toBe(50);
  });
});

describe('statForCategory', () => {
  it('maps deep work → focus and learning → wisdom', () => {
    expect(statForCategory(Category.DEEP_WORK)).toBe('focus');
    expect(statForCategory(Category.LEARNING)).toBe('wisdom');
    expect(statForCategory(Category.MUSIC_AUDIO)).toBeNull();
  });
});
