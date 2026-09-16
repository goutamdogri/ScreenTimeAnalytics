import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Category } from '@screen-time/core';
import { ClassificationCache } from '@screen-time/db';
import { LLMClassification, LLMProvider } from '@screen-time/llm-client';
import {
  ClassificationService,
  PendingEvent,
  StoredClassification,
} from './classification.service';
import { ClassificationWorkerService } from './classification.worker.service';
import { LlmProvidersService } from '../llm/llm-providers.service';

describe('ClassificationWorkerService', () => {
  const EVENTS: PendingEvent[] = [
    {
      id: 'evt-1',
      url: 'https://youtube.com/watch?v=abc',
      windowTitle: null,
      metadata: null,
      device: { userId: 'user-1' },
    },
    {
      id: 'evt-2',
      url: null,
      windowTitle: 'A very long documentary',
      metadata: null,
      device: { userId: 'user-1' },
    },
  ];

  function build(
    options: {
      pending?: PendingEvent[];
      cached?: { category: string; subCategory: string | null } | null;
      fromLlm?: StoredClassification;
      provider?: LLMProvider | null;
      workerEnabled?: boolean;
    } = {},
  ) {
    const pending = options.pending ?? EVENTS;
    let calls = 0;
    const findPending = jest.fn().mockImplementation(async () => {
      if (calls++ >= 1) {
        return [];
      }
      return pending;
    });

    const classification = {
      findPending,
      findCached: jest.fn<() => Promise<ClassificationCache | null>>().mockResolvedValue(
        options.cached
          ? {
              id: 'cache-1',
              createdAt: new Date('2026-09-15T00:00:00.000Z'),
              url: 'https://x',
              category: options.cached.category,
              subCategory: options.cached.subCategory,
              method: 'llm',
            }
          : null,
      ),
      writeCache: jest
        .fn<(url: string, result: StoredClassification, method: string) => Promise<void>>()
        .mockResolvedValue(undefined),
      apply: jest
        .fn<(eventId: string, result: StoredClassification) => Promise<void>>()
        .mockResolvedValue(undefined),
      metadataString: jest
        .fn()
        .mockReturnValue(null) as unknown as ClassificationService['metadataString'],
      fromLlm: jest
        .fn()
        .mockReturnValue(
          options.fromLlm ?? { category: 'long_form_video', subCategory: 'documentary' },
        ),
    } as unknown as ClassificationService;

    const provider =
      options.provider === undefined
        ? ({
            classify: jest.fn<() => Promise<LLMClassification>>().mockResolvedValue({
              category: Category.LONG_FORM_VIDEO,
              confidence: 0.9,
            }),
          } as unknown as LLMProvider)
        : options.provider;
    const llmProviders = {
      buildProviderForUser: jest
        .fn<(userId: string) => Promise<LLMProvider | null>>()
        .mockResolvedValue(provider),
    } as unknown as LlmProvidersService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'classification.workerEnabled') {
          return options.workerEnabled ?? true;
        }
        if (key === 'classification.pollIntervalMs') {
          return 30000;
        }
        if (key === 'classification.batchSize') {
          return 50;
        }
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'classification.batchSize') {
          return 50;
        }
        throw new Error(`Unknown key: ${key}`);
      }),
    } as unknown as ConfigService;

    return {
      worker: new ClassificationWorkerService(configService, classification, llmProviders),
      classification,
      llmProviders,
    };
  }

  describe('lifecycle', () => {
    it('does not start when disabled', () => {
      const { worker, classification } = build({ workerEnabled: false });
      worker.onApplicationBootstrap();
      expect(classification.findPending).not.toHaveBeenCalled();
    });

    it('starts polling on boot when enabled', async () => {
      jest.useFakeTimers();
      const { worker, classification } = build();
      const findPending = classification.findPending as unknown as jest.Mock;
      worker.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(0);
      expect(findPending).toHaveBeenCalled();

      const callCount = findPending.mock.calls.length;
      await jest.advanceTimersByTimeAsync(30000);
      expect(findPending.mock.calls.length).toBeGreaterThan(callCount);
      worker.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('tick', () => {
    it('enriches events end-to-end: cache miss -> LLM -> apply -> cache', async () => {
      const { worker, classification, llmProviders } = build();
      await worker.tick();

      expect(classification.findPending).toHaveBeenCalledWith(50);
      expect(llmProviders.buildProviderForUser).toHaveBeenCalledWith('user-1');
      expect(classification.apply).toHaveBeenNthCalledWith(1, 'evt-1', {
        category: 'long_form_video',
        subCategory: 'documentary',
      });
      expect(classification.writeCache).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=abc',
        {
          category: 'long_form_video',
          subCategory: 'documentary',
        },
        'llm',
      );
    });

    it('holes from the per-URL cache without calling the provider', async () => {
      const { worker, classification, llmProviders } = build({
        pending: [EVENTS[0]!],
        cached: { category: 'learning', subCategory: 'documentation' },
      });
      await worker.tick();
      expect(llmProviders.buildProviderForUser).not.toHaveBeenCalled();
      expect(classification.apply).toHaveBeenNthCalledWith(1, 'evt-1', {
        category: 'learning',
        subCategory: 'documentation',
      });
    });

    it('skips events whose users have no LLM config', async () => {
      const { worker, classification, llmProviders } = build({ provider: null });
      await worker.tick();
      expect(llmProviders.buildProviderForUser).toHaveBeenCalled();
      expect(classification.apply).not.toHaveBeenCalled();
    });

    it('does not persist unusable LLM results', async () => {
      const { worker, classification } = build({ fromLlm: { category: null, subCategory: null } });
      await worker.tick();
      expect(classification.fromLlm).toHaveBeenCalled();
      expect(classification.apply).not.toHaveBeenCalled();
      expect(classification.writeCache).not.toHaveBeenCalled();
    });

    it('falls back to metadata.url for legacy events', async () => {
      const { worker, classification } = build({
        pending: [
          {
            id: 'evt-legacy',
            url: null,
            windowTitle: null,
            metadata: { url: 'https://legacy.dev/x' },
            device: { userId: 'u' },
          },
        ],
      });
      (classification.metadataString as jest.Mock).mockReturnValue('https://legacy.dev/x');
      await worker.tick();
      expect(classification.writeCache).toHaveBeenCalledWith(
        'https://legacy.dev/x',
        expect.anything(),
        'llm',
      );
    });
  });

  describe('resilience', () => {
    it('one failing event does not abort the batch', async () => {
      const provider = {
        classify: jest
          .fn<() => Promise<LLMClassification>>()
          .mockRejectedValue(new Error('network down')),
      } as unknown as LLMProvider;
      const { worker, classification } = build({ provider });
      await expect(worker.tick()).resolves.toBeUndefined();
      expect(classification.apply).not.toHaveBeenCalled();
    });
  });
});
