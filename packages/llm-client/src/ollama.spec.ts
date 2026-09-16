import { ollamaProvider, discoverOllamaModels, isOllamaReachable } from './ollama';

describe('OllamaProvider', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const baseUrl = 'http://localhost:11434';
  const provider = ollamaProvider({ baseUrl, model: 'llama3.1:8b' });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('calls /api/chat with JSON format and parses the message content (no auth header)', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { content: JSON.stringify({ category: 'music_audio', confidence: 0.85 }) },
        }),
        {
          status: 200,
        },
      ),
    );

    const result = await provider.classify('https://music.youtube.com/abc', 'A song');

    expect(result).toMatchObject({ category: 'music_audio', confidence: 0.85 });
    const [, init] = fetchSpy.mock.calls[0] as [string, Record<string, unknown>];
    const body = JSON.parse(init.body as string) as {
      model: string;
      format: string;
      stream: boolean;
    };
    expect(body).toMatchObject({ model: 'llama3.1:8b', format: 'json', stream: false });
    expect(init.headers).not.toHaveProperty('authorization');
  });

  it('discoverOllamaModels returns pulled model names', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'llama3.1:8b' }, { name: 'qwen2.5:14b' }] }), {
        status: 200,
      }),
    );
    await expect(discoverOllamaModels(baseUrl)).resolves.toEqual(['llama3.1:8b', 'qwen2.5:14b']);
  });

  it('discoverOllamaModels tolerates a missing models field', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await expect(discoverOllamaModels(baseUrl)).resolves.toEqual([]);
  });

  it('isOllamaReachable reports availability', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    await expect(isOllamaReachable(baseUrl)).resolves.toBe(true);

    fetchSpy.mockRejectedValue(new Error('connection refused'));
    await expect(isOllamaReachable(baseUrl)).resolves.toBe(false);
  });
});
