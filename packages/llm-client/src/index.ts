/**
 * Provider-agnostic LLM classification client, used only by the Backend (Phase 3).
 *
 * Kept behind a small interface (`LLMProvider`) so the categorization pipeline
 * can depend on the interface only — never on a specific vendor SDK (design doc
 * §8.1: "core depends only on interfaces").
 */

export { LLM_CLIENT_VERSION } from './prompt';

export * from './types';
export * from './validation';
export * from './registry';
export * from './http';
export * from './prompt';

export { OpenAiCompatibleProvider, openAiCompatible } from './openai-compatible';
export type { OpenAiCompatibleOptions } from './openai-compatible';
export { GeminiProvider, geminiProvider } from './gemini';
export type { GeminiOptions } from './gemini';
export { OllamaProvider, ollamaProvider, discoverOllamaModels, isOllamaReachable } from './ollama';
export type { OllamaOptions } from './ollama';
