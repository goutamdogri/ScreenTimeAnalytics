/**
 * Screen Time Analytics — core business logic.
 *
 * This package holds the pure, database-free business rules used by the
 * backend engine: content categorization (rule layer), intentionality
 * scoring, and the XP/quest gamification math (Phases 3 & 5).
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
