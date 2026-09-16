import { describe, expect, it } from '@jest/globals';
import {
  Category,
  LongFormVideoSubCategory,
  isCategory,
  isLongFormVideoSubCategory,
  isSubCategoryForCategory,
  SUB_CATEGORIES_BY_CATEGORY,
  CATEGORIES,
  LONG_FORM_VIDEO_SUB_CATEGORIES,
} from './categories';

describe('categories', () => {
  it('exposes the full top-level taxonomy (design doc §3.1)', () => {
    expect(CATEGORIES).toEqual([
      'deep_work',
      'learning',
      'social_media',
      'short_form_video',
      'long_form_video',
      'music_audio',
      'communication',
      'browsing_research',
      'idle_afk',
      'other',
    ]);
  });

  it('broadens the guard for valid values and rejects junk', () => {
    expect(isCategory('deep_work')).toBe(true);
    expect(isCategory(Category.LONG_FORM_VIDEO)).toBe(true);
    expect(isCategory('productivity')).toBe(false);
    expect(isCategory(42)).toBe(false);
  });

  it('validates top-level categories and long-form sub-categories', () => {
    expect(isLongFormVideoSubCategory(LongFormVideoSubCategory.TECH_REVIEW)).toBe(true);
    expect(isLongFormVideoSubCategory('tech_review')).toBe(true);
    expect(isLongFormVideoSubCategory('deep_work')).toBe(false);
  });

  it('only allows sub-categories under long_form_video (design doc §3.2.1)', () => {
    expect(
      isSubCategoryForCategory(LongFormVideoSubCategory.DOCUMENTARY, Category.LONG_FORM_VIDEO),
    ).toBe(true);
    expect(isSubCategoryForCategory('documentary', Category.LONG_FORM_VIDEO)).toBe(true);
    expect(isSubCategoryForCategory(LongFormVideoSubCategory.DOCUMENTARY, Category.LEARNING)).toBe(
      false,
    );
    expect(isSubCategoryForCategory('music_audio', Category.LONG_FORM_VIDEO)).toBe(false);
  });

  it('keeps the sub-category map aligned with the enums', () => {
    for (const category of CATEGORIES) {
      for (const sub of SUB_CATEGORIES_BY_CATEGORY[category]) {
        expect(LONG_FORM_VIDEO_SUB_CATEGORIES).toContain(sub);
      }
    }
    expect(SUB_CATEGORIES_BY_CATEGORY[Category.LONG_FORM_VIDEO]).toHaveLength(
      LONG_FORM_VIDEO_SUB_CATEGORIES.length,
    );
  });
});
