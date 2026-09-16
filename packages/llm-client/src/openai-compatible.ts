import { LLMClassification, LLMProvider } from './types';
import { extractJsonField, parseLLMClassification } from './validation';
import { postJson } from './http';
import { classificationUserPrompt, CLASSIFICATION_SYSTEM_PROMPT } from './prompt';

/**
 * OpenAI-compatible chat completions client. Covers OpenAI itself, Groq (which
 * exposes an OpenAI-compatible endpoint), and any other OpenAI-compatible
 * service via a custom `baseUrl` — one implementation, many registry entries.
 */
export interface OpenAiCompatibleOptions {
  apiKey: string;
  /** e.g. `https://api.openai.com/v1` or `https://api.groq.com/openai/v1`. */
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export class OpenAiCompatibleProvider implements LLMProvider {
  constructor(
    readonly id: string,
    private readonly options: OpenAiCompatibleOptions,
  ) {}

  async classify(url: string, pageTitle: string): Promise<LLMClassification> {
    const data = (await postJson(
      `${this.options.baseUrl}/chat/completions`,
      {
        model: this.options.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: classificationUserPrompt(url, pageTitle) },
        ],
      },
      {
        headers: { authorization: `Bearer ${this.options.apiKey}` },
      },
    )) as ChatCompletionResponse;

    const content = data.choices?.[0]?.message?.content;
    return parseLLMClassification(extractJsonField(content));
  }
}

export function openAiCompatible(id: string, options: OpenAiCompatibleOptions): LLMProvider {
  return new OpenAiCompatibleProvider(id, options);
}
