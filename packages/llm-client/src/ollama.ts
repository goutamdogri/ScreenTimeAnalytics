import { LLMClassification, LLMProvider } from './types';
import { extractJsonField, parseLLMClassification } from './validation';
import { getJson, postJson } from './http';
import { classificationUserPrompt, CLASSIFICATION_SYSTEM_PROMPT } from './prompt';

/**
 * Local Ollama client (design doc §3.3). No API key — the backend must be able
 * to reach the Ollama instance, which only works in self-hosted deployments.
 * Uses Ollama's native `/api/chat` (with `format: "json"`) so no key or SDK is
 * required; discovery happens through `/api/tags`.
 */
export interface OllamaOptions {
  /** e.g. `http://localhost:11434`. */
  baseUrl: string;
  model: string;
}

interface ChatResponse {
  message?: { content?: string };
}

export class OllamaProvider implements LLMProvider {
  constructor(
    readonly id: string,
    private readonly options: OllamaOptions,
  ) {}

  async classify(url: string, pageTitle: string): Promise<LLMClassification> {
    // Local inference can take a while — generous timeout.
    const data = (await postJson(
      `${this.options.baseUrl}/api/chat`,
      {
        model: this.options.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: classificationUserPrompt(url, pageTitle) },
        ],
      },
      {
        timeoutMs: 120_000,
      },
    )) as ChatResponse;

    const content = data.message?.content;
    return parseLLMClassification(extractJsonField(content));
  }
}

export function ollamaProvider(options: OllamaOptions): LLMProvider {
  return new OllamaProvider('ollama', options);
}

/** Pulled model list for `GET /api/tags` (design doc §3.3 auto-detection). */
export async function discoverOllamaModels(baseUrl: string): Promise<string[]> {
  const data = (await getJson(`${baseUrl}/api/tags`)) as { models?: { name?: string }[] };
  if (!Array.isArray(data.models)) {
    return [];
  }
  return data.models
    .map((model) => model.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

/** Cheap reachability probe used by `GET /llm/providers`. */
export async function isOllamaReachable(baseUrl: string): Promise<boolean> {
  try {
    await getJson(`${baseUrl}/api/tags`, 3_000);
    return true;
  } catch {
    return false;
  }
}
