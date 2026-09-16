import { ConfigService } from '@nestjs/config';
import {
  buildProvider,
  discoverOllamaModels,
  isOllamaReachable,
  LLMProvider,
  LlmProviderType,
  PROVIDER_CATALOG,
} from '@screen-time/llm-client';
import { LlmConfig } from '@screen-time/db';
import { LlmProvidersService } from './llm-providers.service';
import { LlmConfigService } from './llm-config.service';

jest.mock('@screen-time/llm-client', () => {
  const actual =
    jest.requireActual<typeof import('@screen-time/llm-client')>('@screen-time/llm-client');
  return {
    ...actual,
    isOllamaReachable: jest.fn(),
    discoverOllamaModels: jest.fn(),
    buildProvider: jest.fn(),
  };
});

const isOllamaReachableMock = isOllamaReachable as unknown as jest.Mock<
  Promise<boolean>,
  [baseUrl: string]
>;
const discoverOllamaModelsMock = discoverOllamaModels as unknown as jest.Mock<
  Promise<string[]>,
  [baseUrl: string]
>;
const buildProviderMock = buildProvider as unknown as jest.Mock;

describe('LlmProvidersService', () => {
  const USER_ID = 'user-1';

  function buildService(
    options: { config?: Partial<LlmConfig> | null; decryptKey?: string | null } = {},
  ) {
    const llmConfigService = {
      findByUser: jest
        .fn<Promise<Partial<LlmConfig> | null>, [userId: string]>()
        .mockResolvedValue(options.config ?? null),
      decryptKey: jest.fn().mockReturnValue(options.decryptKey ?? null),
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:11434'),
    } as unknown as ConfigService;
    return {
      service: new LlmProvidersService(
        llmConfigService as unknown as LlmConfigService,
        configService,
      ),
      llmConfigService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailability', () => {
    it('probes Ollama and lists only available cloud providers the user has keys for', async () => {
      isOllamaReachableMock.mockResolvedValue(true);
      discoverOllamaModelsMock.mockResolvedValue(['llama3.2']);
      const { service } = buildService({
        config: { provider: 'openai', encryptedApiKey: 'enc:x' },
      });

      const result = await service.getAvailability(USER_ID);

      expect(result.local).toEqual({ available: true, models: ['llama3.2'] });
      const openai = result.cloud.items.find((i) => i.id === 'openai');
      const groq = result.cloud.items.find((i) => i.id === 'groq');
      expect(openai?.configured).toBe(true);
      expect(groq?.configured).toBe(false);
      expect(openai?.models).toEqual(PROVIDER_CATALOG.openai.defaultModels);
      expect(result.cloud.items.some((i) => i.id === 'ollama')).toBe(false);
    });

    it('reports local availability as false when Ollama is unreachable', async () => {
      isOllamaReachableMock.mockResolvedValue(false);
      discoverOllamaModelsMock.mockResolvedValue([]);
      const { service } = buildService();
      const result = await service.getAvailability(USER_ID);
      expect(result.local.available).toBe(false);
      expect(isOllamaReachableMock).toHaveBeenCalledWith('http://localhost:11434');
    });
  });

  describe('buildProviderForUser', () => {
    it('returns null for users without LLM settings (rule-only mode)', async () => {
      const { service } = buildService();
      expect(await service.buildProviderForUser(USER_ID)).toBeNull();
      expect(buildProviderMock).not.toHaveBeenCalled();
    });

    it('builds a provider from the stored, decrypted config', async () => {
      const fakeProvider = { name: 'OpenAI', classify: jest.fn() } as unknown as LLMProvider;
      buildProviderMock.mockReturnValue(fakeProvider);
      const { service, llmConfigService } = buildService({
        config: { provider: 'groq', model: 'llama-3.1-8b-instant', encryptedApiKey: 'enc:k' },
        decryptKey: 'plain-key',
      });

      const provider = await service.buildProviderForUser(USER_ID);

      expect(provider).toBe(fakeProvider);
      expect(llmConfigService.decryptKey).toHaveBeenCalled();
      expect(buildProviderMock).toHaveBeenCalledWith({
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        apiKey: 'plain-key',
      });
    });

    it('degrades to null when the stored config cannot be built', async () => {
      buildProviderMock.mockImplementation(() => {
        throw new Error(`Unknown provider "nonsense".`);
      });
      const { service } = buildService({
        config: {
          provider: 'nonsense' as unknown as LlmProviderType,
          model: 'x',
          encryptedApiKey: 'enc:k',
        },
        decryptKey: 'plain-key',
      });
      expect(await service.buildProviderForUser(USER_ID)).toBeNull();
    });
  });
});
