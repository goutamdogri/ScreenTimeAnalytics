import { geminiProvider } from './gemini';

describe('GeminiProvider', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const provider = geminiProvider({ apiKey: 'g-key', baseUrl, model: 'gemini-2.0-flash' });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('calls generateContent with the x-goog-api-key header and parses the text part', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '{"category":"learning","confidence":0.7}' }] } },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await provider.classify('https://coursera.org/course', 'Data Science');

    expect(result).toMatchObject({ category: 'learning', confidence: 0.7 });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${baseUrl}/models/gemini-2.0-flash:generateContent`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'g-key' }),
      }),
    );
  });

  it('parses a JSON-encoded string text field', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ category: 'social_media', confidence: 0.6 }) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await provider.classify('https://x.com/foo', 'Feed');
    expect(result).toMatchObject({ category: 'social_media' });
  });

  it('degrades missing candidates to the safe fallback', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const result = await provider.classify('https://x.com/foo', 'Feed');
    expect(result.category).toBe('other');
    expect(result.confidence).toBe(0);
  });
});
