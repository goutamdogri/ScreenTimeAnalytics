import { Injectable } from '@nestjs/common';
import { LlmConfig } from '@screen-time/db';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { SaveLlmConfigDto } from './dto/llm.dto';

/**
 * CRUD for per-user LLM settings (design doc §3.3). The API key is encrypted at
 * rest with AES-256-GCM and is never returned to callers — the controller sends
 * a boolean `hasApiKey` instead.
 */
@Injectable()
export class LlmConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async findByUser(userId: string): Promise<LlmConfig | null> {
    return this.prisma.llmConfig.findUnique({ where: { userId } });
  }

  /** Saves settings; without a new `apiKey` the existing stored key is kept. */
  async save(userId: string, dto: SaveLlmConfigDto): Promise<LlmConfig> {
    const existing = await this.findByUser(userId);
    const encryptedApiKey = dto.apiKey
      ? this.crypto.encrypt(dto.apiKey)
      : existing?.encryptedApiKey;

    return this.prisma.llmConfig.upsert({
      where: { userId },
      update: {
        provider: dto.provider,
        model: dto.model,
        encryptedApiKey,
      },
      create: {
        userId,
        provider: dto.provider,
        model: dto.model,
        encryptedApiKey,
      },
    });
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.llmConfig.deleteMany({ where: { userId } });
  }

  /** The plaintext key, decrypted in memory only — never logged or returned. */
  decryptKey(config: LlmConfig): string | null {
    if (!config.encryptedApiKey) {
      return null;
    }
    return this.crypto.decrypt(config.encryptedApiKey);
  }
}
