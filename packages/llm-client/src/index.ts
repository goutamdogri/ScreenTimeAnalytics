/**
 * Provider-agnostic LLM classification client, used only by the Backend (Phase 3).
 *
 * Kept behind a small interface (`LLMProvider`) so the categorization pipeline
 * in `@screen-time/core` can depend on the interface only — never on a specific
 * vendor SDK (design doc §8.1: "core depends only on interfaces").
 */

export interface LLMClassification {
  category: string;
  subCategory?: string;
  confidence: number;
}

export interface LLMProvider {
  /** Classifies a URL + page title without DOM scraping (design doc §3.2). */
  classify(url: string, pageTitle: string): Promise<LLMClassification>;
}

export const LLM_CLIENT_VERSION = '0.1.0';
