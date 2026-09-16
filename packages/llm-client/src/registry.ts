import { LLMProvider } from './types';
import { openAiCompatible } from './openai-compatible';
import { geminiProvider } from './gemini';
import { ollamaProvider } from './ollama';

/**
 * Provider catalog + factory (design doc §3.3, §8.1).
 *
 * Adding a new provider (open-weight cloud models, opencode-style endpoints,
 * etc.) is a one-line registry entry — the pipeline, DTOs, and worker never
 * change. `GET /llm/providers` is rendered from this catalog combined with
 * per-user stored config.
 */

export const LLM_PROVIDER_IDS = ['openai', 'groq', 'gemini', 'ollama'] as const;
export type LlmProviderType = (typeof LLM_PROVIDER_IDS)[number];

export interface ProviderDescriptor {
  id: LlmProviderType;
  label: string;
  /** An API key is mandatory (all non-Ollama providers today). */
  keyRequired: boolean;
  /** Only Ollama is discoverable locally; cloud providers are always "available". */
  available: boolean;
  defaultBaseUrl: string;
  defaultModels: string[];
}

export const PROVIDER_CATALOG: Readonly<Record<LlmProviderType, ProviderDescriptor>> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyRequired: true,
    available: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o-mini', 'gpt-4o'],
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    keyRequired: true,
    available: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyRequired: true,
    available: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.0-flash', 'gemini-1.5-flash'],
  },
  ollama: {
    id: 'ollama',
    label: 'Local (Ollama)',
    keyRequired: false,
    available: false, // only becomes available after a successful reachability probe
    defaultBaseUrl: 'http://localhost:11434',
    defaultModels: [],
  },
};

export function isLlmProviderType(value: unknown): value is LlmProviderType {
  return typeof value === 'string' && (LLM_PROVIDER_IDS as readonly string[]).includes(value);
}

export interface BuildProviderParams {
  provider: LlmProviderType;
  model: string;
  apiKey?: string;
  /** Optional override (custom OpenAI-compatible endpoints, non-default Ollama). */
  baseUrl?: string;
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

/** Builds a ready-to-call provider from stored settings or throws a friendly error. */
export function buildProvider(params: BuildProviderParams): LLMProvider {
  const descriptor = PROVIDER_CATALOG[params.provider];

  if (descriptor.keyRequired && !params.apiKey) {
    throw new ProviderConfigurationError(
      `Provider "${params.provider}" requires an API key (${descriptor.label}).`,
    );
  }

  const baseUrl = params.baseUrl ?? descriptor.defaultBaseUrl;

  switch (params.provider) {
    case 'openai':
      return openAiCompatible('openai', {
        apiKey: params.apiKey as string,
        baseUrl,
        model: params.model,
      });
    case 'groq':
      return openAiCompatible('groq', {
        apiKey: params.apiKey as string,
        baseUrl,
        model: params.model,
      });
    case 'gemini':
      return geminiProvider({ apiKey: params.apiKey as string, baseUrl, model: params.model });
    case 'ollama':
      return ollamaProvider({ baseUrl, model: params.model });
  }
}
