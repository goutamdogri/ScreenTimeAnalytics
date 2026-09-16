import {
  CATEGORIES,
  Category,
  LONG_FORM_VIDEO_SUB_CATEGORIES,
  LongFormVideoSubCategory,
  isSubCategoryForCategory,
} from '@screen-time/core';
import { LLMClassification } from './types';

/**
 * Validation of model responses before they are trusted (design doc §8.2).
 *
 * Model output is unreliable by nature: an unparseable payload, an unknown
 * category, or a nonsense sub-category must degrade to a safe fallback instead
 * of corrupting the classification cache.
 */

const CATEGORY_SET = new Set<string>(CATEGORIES);
const SUB_CATEGORY_SET = new Set<string>(LONG_FORM_VIDEO_SUB_CATEGORIES);

export const DEFAULT_SAFE_CONFIDENCE = 0.5;

/**
 * Parses arbitrary model output into a trustworthy `LLMClassification`.
 *
 * - Non-JSON / missing fields → `other` with confidence 0 (callers may decide
 *   this is not worth caching).
 * - Unknown category string → `other`.
 * - Illegal sub-category (not valid for the returned top-level category) →
 *   dropped.
 * - Confidence clamped to [0, 1].
 */
export function parseLLMClassification(raw: unknown): LLMClassification {
  const fallback: LLMClassification = { category: Category.OTHER, confidence: 0 };

  if (typeof raw !== 'object' || raw === null) {
    return fallback;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.category !== 'string' || !CATEGORY_SET.has(obj.category)) {
    return fallback;
  }
  const category = obj.category as Category;

  let subCategory: LongFormVideoSubCategory | undefined;
  if (obj.subCategory !== undefined) {
    const candidate = obj.subCategory;
    if (typeof candidate === 'string' && SUB_CATEGORY_SET.has(candidate)) {
      subCategory = candidate as LongFormVideoSubCategory;
    }
  }

  if (subCategory !== undefined && !isSubCategoryForCategory(subCategory, category)) {
    subCategory = undefined;
  }

  const rawConfidence = obj.confidence;
  const confidence =
    typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : DEFAULT_SAFE_CONFIDENCE;

  const parsed: LLMClassification = { category, confidence };
  if (subCategory !== undefined) {
    parsed.subCategory = subCategory;
  }
  if (typeof obj.reason === 'string' && obj.reason.length > 0) {
    parsed.reason = obj.reason.slice(0, 200);
  }
  return parsed;
}

/**
 * Safely extracts a JSON object from a chat/tags payload field that may be a
 * pre-parsed object or a JSON-encoded string (provider responses differ).
 */
export function extractJsonField(value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0) {
    return extractJsonField(value[0]);
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value ?? null;
}
