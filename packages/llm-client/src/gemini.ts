import { LLMClassification, LLMProvider } from './types';
import { extractJsonField, parseLLMClassification } from './validation';
import { postJson } from './http';
import { classificationUserPrompt, CLASSIFICATION_SYSTEM_PROMPT } from './prompt';

/**
 * Google Gemini (generativelanguage.googleapis.com) client. Uses the modern
 * `key` query API-free flow via the `x-goog-api-key` header so the key never
 * leaks into the URL or logs.
 */
export interface GeminiOptions {
  apiKey: string;
  /** e.g. `https://generativelanguage.googleapis.com/v1beta`. */
  baseUrl: string;
  model: string;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GeminiProvider implements LLMProvider {
  constructor(
    readonly id: string,
    private readonly options: GeminiOptions,
  ) {}

  async classify(url: string, pageTitle: string): Promise<LLMClassification> {
    const endpoint = `${this.options.baseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`;
    const data = (await postJson(
      endpoint,
      {
        contents: [
          {
            parts: [
              { text: CLASSIFICATION_SYSTEM_PROMPT },
              { text: classificationUserPrompt(url, pageTitle) },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      },
      {
        headers: { 'x-goog-api-key': this.options.apiKey },
      },
    )) as GenerateContentResponse;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return parseLLMClassification(extractJsonField(text));
  }
}

export function geminiProvider(options: GeminiOptions): LLMProvider {
  return new GeminiProvider('gemini', options);
}
