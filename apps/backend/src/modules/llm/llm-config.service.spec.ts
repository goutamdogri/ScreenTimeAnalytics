import { LlmConfig } from '@screen-time/db';
import { LlmConfigService } from './llm-config.service';
import { SaveLlmConfigDto } from './dto/llm.dto';

describe('LlmConfigService', () => {
  const USER_ID = 'user-1';

  function buildService(
    overrides: {
      config?: Partial<LlmConfig>;
      encrypt?: jest.Mock;
      decrypt?: jest.Mock;
    } = {},
  ) {
    const crypto = {
      encrypt: overrides.encrypt ?? jest.fn((s: string) => `enc:${s}`),
      decrypt: overrides.decrypt ?? jest.fn((s: string) => `dec:${s}`),
    };
    const config: LlmConfig = {
      userId: USER_ID,
      provider: overrides.config?.provider ?? 'openai',
      model: overrides.config?.model ?? 'gpt-4o-mini',
      encryptedApiKey: overrides.config?.encryptedApiKey ?? 'enc:key',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: overrides.config?.updatedAt ?? new Date('2026-09-15T00:00:00.000Z'),
    };
    const prisma = {
      llmConfig: {
        findUnique: jest.fn<Promise<LlmConfig | null>, unknown[]>().mockResolvedValue(config),
        upsert: jest.fn<Promise<LlmConfig>, unknown[]>().mockResolvedValue(config),
        deleteMany: jest
          .fn<Promise<{ count: number }>, unknown[]>()
          .mockResolvedValue({ count: 1 }),
      },
    };
    return { service: new LlmConfigService(prisma as any, crypto as any), prisma, crypto };
  }

  function dto(partial: Partial<SaveLlmConfigDto> = {}): SaveLlmConfigDto {
    return { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-test-123', ...partial };
  }

  it('reads the per-user config', async () => {
    const { service, prisma } = buildService();
    await service.findByUser(USER_ID);
    expect(prisma.llmConfig.findUnique).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('encrypts a fresh api key on save', async () => {
    const { service, prisma, crypto } = buildService();
    await service.save(USER_ID, dto());
    expect(crypto.encrypt).toHaveBeenCalledWith('sk-test-123');
    expect(prisma.llmConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        create: expect.objectContaining({ encryptedApiKey: 'enc:sk-test-123' }),
      }),
    );
  });

  it('keeps the stored key when apiKey is omitted (rotation safety)', async () => {
    const { service, prisma, crypto } = buildService({
      config: { encryptedApiKey: 'enc:old-key' },
    });
    const configService = service as unknown as {
      findByUser: jest.Mock<Promise<{ encryptedApiKey: string }>, [userId: string]>;
    };
    configService.findByUser = jest
      .fn<Promise<{ encryptedApiKey: string }>, [userId: string]>()
      .mockResolvedValue({
        encryptedApiKey: 'enc:old-key',
      });
    await service.save(USER_ID, dto({ apiKey: undefined }));
    expect(crypto.encrypt).not.toHaveBeenCalled();
    expect(prisma.llmConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ encryptedApiKey: 'enc:old-key' }),
      }),
    );
  });

  it('clears the config without error when none exists', async () => {
    const { service, prisma } = buildService();
    prisma.llmConfig.deleteMany.mockResolvedValue({ count: 0 });
    await service.clear(USER_ID);
    expect(prisma.llmConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('decrypts stored keys in memory only', () => {
    const { service, crypto } = buildService();
    const stored = {
      userId: USER_ID,
      provider: 'openai',
      model: 'gpt-4o-mini',
      encryptedApiKey: 'enc:x',
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies LlmConfig;
    expect(service.decryptKey(stored)).toBe('dec:enc:x');
    expect(service.decryptKey({ ...stored, encryptedApiKey: null })).toBeNull();
    expect(crypto.decrypt).toHaveBeenCalledTimes(1);
  });
});
