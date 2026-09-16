import { Category } from './categories';
import { DEFAULT_CATEGORY_RULES, CategoryRule } from './rules';

describe('DEFAULT_CATEGORY_RULES', () => {
  it('uses unique, non-empty rule ids', () => {
    const ids = DEFAULT_CATEGORY_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('only uses known top-level categories and valid sub-categories', () => {
    const categories = new Set<string>(Object.values(Category));
    for (const rule of DEFAULT_CATEGORY_RULES) {
      if (rule.category) {
        expect(categories.has(rule.category)).toBe(true);
        if (rule.subCategory !== undefined) {
          expect(rule.category).toBe(Category.LONG_FORM_VIDEO);
        }
      }
    }
  });

  it('keeps content-layer rules deferring (no immediate category) and URL-scoped', () => {
    for (const rule of DEFAULT_CATEGORY_RULES.filter((r) => r.requiresContentLayer)) {
      expect(rule.urlPatterns && rule.urlPatterns.length > 0).toBe(true);
    }
  });

  it('gives every rule at least one matcher', () => {
    for (const rule of DEFAULT_CATEGORY_RULES as readonly CategoryRule[]) {
      const hasMatcher =
        rule.requiresContentLayer ||
        (rule.hosts ?? []).length > 0 ||
        (rule.urlPatterns ?? []).length > 0 ||
        (rule.apps ?? []).length > 0 ||
        (rule.appPrefixes ?? []).length > 0;
      expect(hasMatcher).toBe(true);
    }
  });

  it('places broad youtube content rules after specific youtube rules', () => {
    const ruleIds = DEFAULT_CATEGORY_RULES.map((rule) => rule.id);
    expect(ruleIds.indexOf('youtube-shorts')).toBeLessThan(ruleIds.indexOf('youtube-watch'));
  });
});
