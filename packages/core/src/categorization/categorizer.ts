import { EventSource, EventType } from '../events';
import { Category, LongFormVideoSubCategory } from './categories';
import { CategoryRule, DEFAULT_CATEGORY_RULES } from './rules';

/**
 * Rule-based content categorization (design doc §3.2 step 1).
 *
 * Pure and deterministic: same input → same output, no I/O, no clock. The
 * backend calls this synchronously at ingest time; the async LLM content layer
 * runs later (design doc §3.2 step 2) for rows that still have no category.
 */

export type CategorizationBasis = 'rule' | 'llm' | 'unknown';

export interface CategorizationResult {
  /**
   * `null` when no rule matched and the worker should consider the LLM content
   * layer — this is what makes `raw_events.category IS NULL` the worker's queue.
   */
  category: Category | null;
  subCategory?: LongFormVideoSubCategory | null;
  /** Where the classification came from (the LLM path sets `llm` in the worker). */
  basis: CategorizationBasis;
  /** 1 for deterministic rules, model-reported for LLM, 0 for unknown. */
  confidence: number;
}

export interface CategorizeEventInput {
  source: EventSource;
  eventType: EventType;
  app?: string | null;
  url?: string | null;
  windowTitle?: string | null;
}

function ruleResult(
  category: Category,
  subCategory?: LongFormVideoSubCategory,
): CategorizationResult {
  return { category, subCategory: subCategory ?? null, basis: 'rule', confidence: 1 };
}

function unknownResult(): CategorizationResult {
  return { category: null, subCategory: null, basis: 'unknown', confidence: 0 };
}

/** Lowercases hostname and strips a leading `www.`. Returns null for non-http(s). */
export function urlHostname(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function ruleMatchesUrl(rule: CategoryRule, url: string, hostname: string | null): boolean {
  if (rule.hosts && hostname !== null && rule.hosts.includes(hostname)) {
    return true;
  }
  if (!rule.urlPatterns) {
    return false;
  }
  return rule.urlPatterns.some((source) => new RegExp(source).test(url));
}

function ruleMatchesApp(rule: CategoryRule, app: string): boolean {
  const normalized = app.toLowerCase();
  if (rule.apps && rule.apps.includes(app)) {
    return true;
  }
  if (
    rule.appPrefixes &&
    rule.appPrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()))
  ) {
    return true;
  }
  return false;
}

function findUrlRule(url: string, hostname: string | null): CategoryRule | undefined {
  for (const rule of DEFAULT_CATEGORY_RULES) {
    if (rule.hosts || rule.urlPatterns) {
      if (ruleMatchesUrl(rule, url, hostname)) {
        return rule;
      }
    }
  }
  return undefined;
}

function findAppRule(app: string): CategoryRule | undefined {
  for (const rule of DEFAULT_CATEGORY_RULES) {
    if (rule.apps || rule.appPrefixes) {
      if (ruleMatchesApp(rule, app)) {
        return rule;
      }
    }
  }
  return undefined;
}

/**
 * Classifies one raw observation. Order of precedence:
 *   1. Idle → `idle_afk`; MPRIS media → `music_audio` (state-level rules).
 *   2. URL rules when the event carries a URL (browse events, extension layer).
 *   3. App rules when the event carries an app name (focus/media events).
 *   4. Fallback: extension browse events are `browsing_research` (§3.1), all
 *      other unmatched events are left `unknown` for the content layer.
 */
export function categorizeEvent(input: CategorizeEventInput): CategorizationResult {
  const { source, eventType, app, url } = input;

  if (source === 'x11' && eventType === 'idle') {
    return ruleResult(Category.IDLE_AFK);
  }
  if (source === 'mpris' && eventType === 'media') {
    return ruleResult(Category.MUSIC_AUDIO);
  }

  const hostname = urlHostname(url);
  if (url || hostname !== null) {
    const rule = findUrlRule(url ?? '', hostname);
    if (rule) {
      if (rule.requiresContentLayer || rule.category === undefined) {
        return unknownResult();
      }
      return ruleResult(rule.category, rule.subCategory);
    }
    if (source === 'extension' && eventType === 'browse') {
      return ruleResult(Category.BROWSING_RESEARCH);
    }
    return unknownResult();
  }

  if (app) {
    const rule = findAppRule(app);
    if (rule) {
      if (rule.requiresContentLayer || rule.category === undefined) {
        return unknownResult();
      }
      return ruleResult(rule.category, rule.subCategory);
    }
  }

  return unknownResult();
}
