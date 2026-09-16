import { describe, expect, it } from 'vitest';
import { categoryColor, categoryLabel } from './category-colors';

describe('categoryColor', () => {
  it('returns a CSS color for every known category', () => {
    expect(categoryColor('deep_work')).toBe('#4C7AE8');
    expect(categoryColor('social_media')).toBe('#D96E4F');
    expect(categoryColor('music_audio')).toBe('#3FA76A');
  });

  it('returns a fallback hex for an unknown category', () => {
    const color = categoryColor('unknown');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('categoryLabel', () => {
  it('returns a human-readable label for known categories', () => {
    expect(categoryLabel('deep_work')).toBe('Deep work');
    expect(categoryLabel('short_form_video')).toBe('Short video');
  });

  it('returns the generic label for an unknown category', () => {
    expect(categoryLabel('foo_bar')).toBe('Other');
  });
});
