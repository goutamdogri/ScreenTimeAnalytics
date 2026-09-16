import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildProvider,
  discoverOllamaModels,
  isOllamaReachable,
  LlmProviderType,
  LLMProvider,
  ProviderDescriptor,
  PROVIDER_CATALOG,
} from '@screen-time/llm-client';
import { ProviderAvailabilityResponse, CloudProviderItemDto } from './dto/llm.dto';
import { LlmConfigService } from './llm-config.service';

/**
 * Provider catalog surfaced to the settings UI (design doc §3.3) plus the
 * resolver used by the classification worker.
 *
 * Local availability is actively probed (Ollama reachability + pulled models) —
 * there is no manual "local vs cloud" toggle and no hardcoded guess: a
 * cloud-hosted backend simply reports the local provider as unavailable.
 */
@Injectable()
export class LlmProvidersService {
  private readonly logger = new Logger(LlmProvidersService.name);

  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly configService: ConfigService,
  ) {}

  get ollamaBaseUrl(): string {
    return this.configService.getOrThrow<string>('llm.ollamaUrl');
  }

  async getAvailability(userId: string): Promise<ProviderAvailabilityResponse> {
    const userConfig = await this.llmConfigService.findByUser(userId);
    const hasKey = (provider: ProviderDescriptor): boolean =>
      userConfig?.provider === provider.id && Boolean(userConfig.encryptedApiKey);

    const [ollamaReachable, ollamaModels] = await Promise.all([
      isOllamaReachable(this.ollamaBaseUrl),
      discoverOllamaModels(this.ollamaBaseUrl),
    ]);

    const cloudItems: CloudProviderItemDto[] = Object.values(PROVIDER_CATALOG)
      .filter((descriptor) => descriptor.available && descriptor.id !== 'ollama')
      .map((descriptor) => ({
        id: descriptor.id,
        label: descriptor.label,
        configured: hasKey(descriptor),
        models: descriptor.defaultModels,
      }));

    return {
      local: {
        available: ollamaReachable,
        models: ollamaModels,
      },
      cloud: { items: cloudItems },
    };
  }

  /**
   * Builds a callable provider for the user's stored config, or `null` when the
   * user has no config (rule-only mode — the worker simply skips).
   */
  async buildProviderForUser(userId: string): Promise<LLMProvider | null> {
    const config = await this.llmConfigService.findByUser(userId);
    if (!config) {
      return null;
    }
    const apiKey = this.llmConfigService.decryptKey(config);
    try {
      return buildProvider({
        provider: config.provider as LlmProviderType,
        model: config.model,
        apiKey: apiKey ?? undefined,
      });
    } catch (error) {
      this.logger.warn(
        `Provider configuration invalid for user ${userId}: ${(error as Error).message}. Falling back to rule-only classification.`,
      );
      return null;
    }
  }
}
