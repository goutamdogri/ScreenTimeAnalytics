import { Category, LongFormVideoSubCategory } from '@screen-time/core';

/**
 * A single content classification produced by an LLM provider (design doc §3.2
 * step 2). Always validated against the core taxonomy before it is trusted
 * (design doc §8.2 — LLM classification responses validated before being
 * trusted).
 */
export interface LLMClassification {
  category: Category;
  subCategory?: LongFormVideoSubCategory;
  /** 0..1; low confidence should route to a fallback category. */
  confidence: number;
  /** Short human-readable rationale, stored for debuggability only. */
  reason?: string;
}

/**
 * Provider-agnostic classification client, used only by the Backend (Phase 3).
 *
 * Kept behind this small interface so the categorization pipeline can depend on
 * the interface only — never on a specific vendor SDK (design doc §8.1: "core
 * depends only on interfaces"). New providers register through
 * `ProviderRegistry` without touching callers.
 */
export interface LLMProvider {
  /** Stable provider id, e.g. `openai` | `groq` | `gemini` | `ollama`. */
  readonly id: string;
  /** Classifies a URL + page title without DOM scraping (design doc §3.2). */
  classify(url: string, pageTitle: string): Promise<LLMClassification>;
}
