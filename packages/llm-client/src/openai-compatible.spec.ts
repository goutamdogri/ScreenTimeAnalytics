import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { openAiCompatible } from './openai-compatible';
import { ProviderHttpError } from './http';

describe('OpenAiCompatibleProvider (OpenAI + Groq)', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  const providerUrl = 'https://api.groq.com/openai/v1';
  const provider = openAiCompatible('groq', {
    apiKey: 'test-key',
    baseUrl: providerUrl,
    model: 'llama-3.3-70b-versatile',
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('calls /chat/completions with auth header and JSON mode', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"category":"deep_work","confidence":0.9}' } }],
        }),
        {
          status: 200,
        },
      ),
    );

    const result = await provider.classify('https://github.com/foo', 'A repo');

    expect(result.category).toBe('deep_work');
    expect(fetchSpy).toHaveBeenCalledWith(
      `${providerUrl}/chat/completions`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer test-key' }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, Record<string, unknown>];
    const body = JSON.parse(init.body as string) as {
      model: string;
      response_format: { type: string };
      messages: { role: string }[];
    };
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('parses a JSON-encoded string content field and long-form sub-category', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'long_form_video',
                  subCategory: 'tech_review',
                  confidence: 0.8,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await provider.classify('https://youtube.com/watch?v=x', 'Review');
    expect(result).toMatchObject({ category: 'long_form_video', subCategory: 'tech_review' });
  });

  it('throws a ProviderHttpError on non-2xx responses', async () => {
    fetchSpy.mockResolvedValue(new Response('rate limited', { status: 429 }));

    await expect(provider.classify('https://x.com/abc', 'Post')).rejects.toBeInstanceOf(
      ProviderHttpError,
    );
  });

  it('throws on invalid JSON bodies', async () => {
    fetchSpy.mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(provider.classify('https://x.com/abc', 'Post')).rejects.toThrow('invalid JSON');
  });
});
