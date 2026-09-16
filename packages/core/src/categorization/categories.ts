/**
 * Content taxonomy (design doc §3.1 and §3.2.1).
 *
 * The single canonical source of truth for what categories exist. The backend,
 * the LLM client, and (eventually) the dashboard all validate against this set,
 * so nothing here should be duplicated anywhere else.
 */

/**
 * Top-level content categories (design doc §3.1).
 */
export enum Category {
  DEEP_WORK = 'deep_work',
  LEARNING = 'learning',
  SOCIAL_MEDIA = 'social_media',
  SHORT_FORM_VIDEO = 'short_form_video',
  LONG_FORM_VIDEO = 'long_form_video',
  MUSIC_AUDIO = 'music_audio',
  COMMUNICATION = 'communication',
  BROWSING_RESEARCH = 'browsing_research',
  IDLE_AFK = 'idle_afk',
  OTHER = 'other',
}

/**
 * Long-form video sub-categories (design doc §3.2.1).
 */
export enum LongFormVideoSubCategory {
  EDUCATIONAL_TUTORIAL = 'educational_tutorial',
  DOCUMENTARY = 'documentary',
  TECH_REVIEW = 'tech_review',
  ENTERTAINMENT_COMEDY = 'entertainment_comedy',
  VLOG_LIFESTYLE = 'vlog_lifestyle',
  NEWS_COMMENTARY = 'news_commentary',
  PODCAST_TALK = 'podcast_talk',
  MUSIC_LONG_FORM = 'music_long_form',
  OTHER = 'other',
}

export const CATEGORIES: readonly Category[] = Object.values(Category);
export const LONG_FORM_VIDEO_SUB_CATEGORIES: readonly LongFormVideoSubCategory[] =
  Object.values(LongFormVideoSubCategory);

/**
 * Which sub-categories are valid for a given top-level category. Today only
 * `long_form_video` carries sub-categories (design doc §3.2.1).
 */
export const SUB_CATEGORIES_BY_CATEGORY: Readonly<
  Record<Category, readonly LongFormVideoSubCategory[]>
> = {
  [Category.DEEP_WORK]: [],
  [Category.LEARNING]: [],
  [Category.SOCIAL_MEDIA]: [],
  [Category.SHORT_FORM_VIDEO]: [],
  [Category.LONG_FORM_VIDEO]: LONG_FORM_VIDEO_SUB_CATEGORIES,
  [Category.MUSIC_AUDIO]: [],
  [Category.COMMUNICATION]: [],
  [Category.BROWSING_RESEARCH]: [],
  [Category.IDLE_AFK]: [],
  [Category.OTHER]: [],
};

const CATEGORY_SET = new Set<string>(CATEGORIES);
const SUB_CATEGORY_SET = new Set<string>(LONG_FORM_VIDEO_SUB_CATEGORIES);

/** Narrowing guard for unknown input (e.g. an LLM response). */
export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

/** Narrowing guard for unknown input (e.g. an LLM response). */
export function isLongFormVideoSubCategory(value: unknown): value is LongFormVideoSubCategory {
  return typeof value === 'string' && SUB_CATEGORY_SET.has(value);
}

/**
 * Validates that a sub-category is legal for its parent category. Any
 * sub-category outside `long_form_video` is rejected, which is exactly what the
 * LLM response validator needs (design doc §8.2 — responses validated before
 * being trusted).
 */
export function isSubCategoryForCategory(
  subCategory: unknown,
  category: Category,
): subCategory is LongFormVideoSubCategory {
  if (!isLongFormVideoSubCategory(subCategory)) {
    return false;
  }
  return SUB_CATEGORIES_BY_CATEGORY[category].includes(subCategory);
}
