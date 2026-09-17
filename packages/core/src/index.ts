/**
 * Screen Time Analytics — core business logic.
 *
 * This package holds the pure, database-free business rules used by the
 * backend engine: content categorization (rule layer), session derivation, and
 * the XP/quest gamification math (Phases 3 & 5).
 *
 * Kept independent from any app/framework so everything here is unit-testable
 * without a database, a browser, or a real LLM call.
 */

export { CORE_VERSION } from './version';

export * from './events';
export * from './categorization/categories';
export * from './categorization/rules';
export * from './categorization/categorizer';

export type {
  CategorizeEventInput,
  CategorizationBasis,
  CategorizationResult,
} from './categorization/categorizer';
export type { CategoryRule } from './categorization/rules';

export * from './sessions/derive';

export * from './gamification/levels';
export * from './gamification/streak';
export * from './gamification/stats';
export * from './gamification/xp';
export * from './gamification/quests';
export * from './gamification/boss';
export * from './gamification/achievements';
