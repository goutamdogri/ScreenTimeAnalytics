import { Category } from '@screen-time/core';

export interface CategoryMeta {
  label: string;
  color: string;
}

/**
 * Canonical dashboard presentation map for the content taxonomy
 * (packages/core, §3.1). Colors are desaturated mid-tones chosen to hold
 * on both paper-light and ink-dark themes. Keep labels non-technical;
 * the enum values are the single source of truth.
 */
export const CATEGORY_META: Readonly<Record<string, CategoryMeta>> = {
  [Category.DEEP_WORK]: { label: 'Deep work', color: '#4C7AE8' },
  [Category.LEARNING]: { label: 'Learning', color: '#2FA3A0' },
  [Category.BROWSING_RESEARCH]: { label: 'Research', color: '#8B6FD1' },
  [Category.SOCIAL_MEDIA]: { label: 'Social media', color: '#D96E4F' },
  [Category.SHORT_FORM_VIDEO]: { label: 'Short video', color: '#D85E7E' },
  [Category.LONG_FORM_VIDEO]: { label: 'Video', color: '#C7912C' },
  [Category.MUSIC_AUDIO]: { label: 'Music & audio', color: '#3FA76A' },
  [Category.COMMUNICATION]: { label: 'Communication', color: '#5A8A9E' },
  [Category.IDLE_AFK]: { label: 'Away', color: '#9A998F' },
  [Category.OTHER]: { label: 'Other', color: '#8A857A' },
};

export const CATEGORY_ORDER: readonly string[] = Object.values(Category);

const FALLBACK: CategoryMeta = { label: 'Other', color: '#8A857A' };

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? FALLBACK;
}

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? FALLBACK.label;
}

export function categoryColor(category: string): string {
  return CATEGORY_META[category]?.color ?? FALLBACK.color;
}
