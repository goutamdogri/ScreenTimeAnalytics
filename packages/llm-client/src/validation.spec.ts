import { Category, LongFormVideoSubCategory } from '@screen-time/core';
import { parseLLMClassification, extractJsonField } from './validation';

describe('parseLLMClassification', () => {
  it('passes through a valid classification', () => {
    const parsed = parseLLMClassification({
      category: 'long_form_video',
      subCategory: 'educational_tutorial',
      confidence: 0.92,
      reason: 'coding tutorial',
    });
    expect(parsed).toEqual({
      category: Category.LONG_FORM_VIDEO,
      subCategory: LongFormVideoSubCategory.EDUCATIONAL_TUTORIAL,
      confidence: 0.92,
      reason: 'coding tutorial',
    });
  });

  it('degrades an unknown category to other with zero confidence', () => {
    expect(parseLLMClassification({ category: 'productivity', confidence: 0.9 })).toEqual({
      category: Category.OTHER,
      confidence: 0,
    });
  });

  it('drops a sub-category that is illegal for the returned category', () => {
    const parsed = parseLLMClassification({
      category: 'learning',
      subCategory: 'documentary',
      confidence: 0.8,
    });
    expect(parsed).toEqual({ category: Category.LEARNING, confidence: 0.8 });
  });

  it('clamps confidence into [0, 1]', () => {
    expect(parseLLMClassification({ category: 'deep_work', confidence: 12 }).confidence).toBe(1);
    expect(parseLLMClassification({ category: 'deep_work', confidence: -3 }).confidence).toBe(0);
  });

  it('defaults missing confidence to a safe mid value', () => {
    expect(parseLLMClassification({ category: 'deep_work' }).confidence).toBe(0.5);
  });

  it('falls back for non-object input', () => {
    expect(parseLLMClassification('garbage')).toEqual({ category: Category.OTHER, confidence: 0 });
    expect(parseLLMClassification(null)).toEqual({ category: Category.OTHER, confidence: 0 });
    expect(parseLLMClassification(undefined)).toEqual({ category: Category.OTHER, confidence: 0 });
  });

  it('ignores unknown sub-category strings', () => {
    const parsed = parseLLMClassification({
      category: 'long_form_video',
      subCategory: 'cooking',
      confidence: 0.9,
    });
    expect(parsed.subCategory).toBeUndefined();
  });
});

describe('extractJsonField', () => {
  it('parses JSON-encoded strings', () => {
    expect(extractJsonField('{"category":"deep_work"}')).toEqual({ category: 'deep_work' });
  });

  it('passes objects and picks the first element of arrays', () => {
    expect(extractJsonField({ a: 1 })).toEqual({ a: 1 });
    expect(extractJsonField(['{"a":1}', '{"a":2}'])).toEqual({ a: 1 });
  });

  it('returns null for garbage strings', () => {
    expect(extractJsonField('not json')).toBeNull();
  });
});
