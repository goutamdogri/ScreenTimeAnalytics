import { describe, expect, it } from '@jest/globals';
import {
  buildProvider,
  isLlmProviderType,
  PROVIDER_CATALOG,
  ProviderConfigurationError,
} from './registry';
import { OpenAiCompatibleProvider } from './openai-compatible';
import { OllamaProvider } from './ollama';
import { GeminiProvider } from './gemini';

describe('ProviderRegistry', () => {
  it('exposes the catalog with the four Phase 3 providers', () => {
    expect(Object.keys(PROVIDER_CATALOG).sort()).toEqual(['gemini', 'groq', 'ollama', 'openai']);
    expect(PROVIDER_CATALOG.ollama.keyRequired).toBe(false);
    expect(PROVIDER_CATALOG.ollama.available).toBe(false);
    expect(PROVIDER_CATALOG.openai.keyRequired).toBe(true);
  });

  it('recognizes valid provider ids', () => {
    expect(isLlmProviderType('openai')).toBe(true);
    expect(isLlmProviderType('ollama')).toBe(true);
    expect(isLlmProviderType('opencode')).toBe(false);
  });

  it('builds keyless Ollama without a key', () => {
    expect(buildProvider({ provider: 'ollama', model: 'llama3.1:8b' })).toBeInstanceOf(
      OllamaProvider,
    );
  });

  it('builds OpenAI-compatible providers with a key (OpenAI + Groq share the class)', () => {
    const openai = buildProvider({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k' });
    const groq = buildProvider({ provider: 'groq', model: 'llama-3.1-8b-instant', apiKey: 'k' });
    expect(openai).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(groq).toBeInstanceOf(OpenAiCompatibleProvider);
  });

  it('builds Gemini with a key', () => {
    expect(
      buildProvider({ provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'k' }),
    ).toBeInstanceOf(GeminiProvider);
  });

  it('refuses cloud providers without a key', () => {
    expect(() => buildProvider({ provider: 'openai', model: 'gpt-4o-mini' })).toThrow(
      ProviderConfigurationError,
    );
    expect(() => buildProvider({ provider: 'gemini', model: 'gemini-2.0-flash' })).toThrow(
      ProviderConfigurationError,
    );
  });

  it('honours custom base URLs (OpenAI-compatible endpoints)', () => {
    const custom = buildProvider({
      provider: 'openai',
      model: 'custom',
      apiKey: 'k',
      baseUrl: 'https://my-endpoint.example/v1',
    });
    expect(custom).toBeInstanceOf(OpenAiCompatibleProvider);
  });
});
