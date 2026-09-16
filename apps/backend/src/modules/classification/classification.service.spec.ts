import { describe, expect, it, jest } from '@jest/globals';
import { Category } from '@screen-time/core';
import { ClassificationCache } from '@screen-time/db';
import { LLMClassification } from '@screen-time/llm-client';
import {
  ClassificationService,
  PendingEvent,
  StoredClassification,
} from './classification.service';

describe('ClassificationService', () => {
  const prismaMock = (methods: Partial<Record<string, jest.Mock>> = {}) =>
    ({
      rawEvent: {
        findMany: methods.findMany ?? jest.fn(),
        update: methods.update ?? jest.fn(),
      },
      classificationCache: {
        findUnique: methods.findUnique ?? jest.fn(),
        upsert: methods.upsert ?? jest.fn(),
      },
    }) as any;

  describe('classify (rule layer)', () => {
    const service = new ClassificationService(prismaMock());

    it('maps known apps through categorical rules synchronously', () => {
      expect(
        service.classify({
          source: 'x11',
          eventType: 'focus',
          app: 'code',
          url: null,
          windowTitle: null,
        }),
      ).toEqual({
        category: 'deep_work',
        subCategory: null,
      });
      expect(
        service.classify({
          source: 'mpris',
          eventType: 'media',
          app: 'spotify',
          url: null,
          windowTitle: 'Song',
        }),
      ).toEqual({
        category: 'music_audio',
        subCategory: null,
      });
    });

    it('detects short-form video URLs before the content layer can run', () => {
      expect(
        service.classify({
          source: 'extension',
          eventType: 'browse',
          app: null,
          url: 'https://www.youtube.com/shorts/abc',
          windowTitle: null,
        }),
      ).toEqual({ category: 'short_form_video', subCategory: null });
    });

    it('leaves the row uncategorized when no rule matches', () => {
      expect(
        service.classify({
          source: 'x11',
          eventType: 'focus',
          app: 'some-app',
          url: null,
          windowTitle: null,
        }),
      ).toEqual({
        category: null,
        subCategory: null,
      });
    });
  });

  describe('fromLlm', () => {
    const service = new ClassificationService(prismaMock());

    it('normalizes subCategory to null and round-trips confident results', () => {
      const llm: LLMClassification = {
        category: Category.SHORT_FORM_VIDEO,
        subCategory: undefined,
        confidence: 0.95,
      };
      expect(service.fromLlm(llm)).toEqual({ category: 'short_form_video', subCategory: null });
    });

    it('refuses zero-confidence results so they are never persisted or cached', () => {
      const llm: LLMClassification = { category: Category.OTHER, confidence: 0 };
      expect(service.fromLlm(llm)).toEqual({ category: null, subCategory: null });
    });
  });

  describe('queue', () => {
    it('scopes pending events to uncategorized rows of users with LLM config', async () => {
      const findMany = jest
        .fn<(...args: unknown[]) => Promise<PendingEvent[]>>()
        .mockResolvedValue([]);
      const service = new ClassificationService(prismaMock({ findMany }));
      await service.findPending(50);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: null,
            device: { user: { llmConfig: { isNot: null } } },
          }),
          take: 50,
        }),
      );
    });

    it('loads the device userId alongside event signals', async () => {
      const event: PendingEvent = {
        id: 'evt-1',
        url: 'https://example.com/watch?v=1',
        windowTitle: null,
        metadata: { url: 'https://example.com/watch?v=1' },
        device: { userId: 'user-1' },
      };
      const findMany = jest
        .fn<(...args: unknown[]) => Promise<PendingEvent[]>>()
        .mockResolvedValue([event]);
      const service = new ClassificationService(prismaMock({ findMany }));
      await expect(service.findPending(1)).resolves.toEqual([event]);
      const firstCall = findMany.mock.calls[0] as unknown as [
        { select: { device: { select: unknown } } },
      ];
      expect(
        (firstCall[0] as { select: { device: { select: unknown } } }).select.device.select,
      ).toEqual({ userId: true });
    });
  });

  describe('caching and writes', () => {
    it('reads the per-URL cache', async () => {
      const findUnique = jest
        .fn<(...args: unknown[]) => Promise<ClassificationCache | null>>()
        .mockResolvedValue(null);
      const service = new ClassificationService(prismaMock({ findUnique }));
      await service.findCached('https://a.b');
      expect(findUnique).toHaveBeenCalledWith({ where: { url: 'https://a.b' } });
    });

    it('skips caching and event updates for unusable classifications', async () => {
      const upsert = jest.fn();
      const update = jest.fn();
      const service = new ClassificationService(prismaMock({ upsert, update }));
      const unusable: StoredClassification = { category: null, subCategory: null };
      await service.writeCache('https://a.b', unusable, 'llm');
      await service.apply('evt-1', unusable);
      expect(upsert).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('upserts cache entries with their classification method', async () => {
      const upsert = jest.fn();
      const service = new ClassificationService(prismaMock({ upsert }));
      await service.writeCache('https://a.b', { category: 'learning', subCategory: 'docs' }, 'llm');
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { url: 'https://a.b' },
          create: { url: 'https://a.b', category: 'learning', subCategory: 'docs', method: 'llm' },
        }),
      );
    });

    it('applies confident classifications back to the raw event', async () => {
      const update = jest.fn();
      const service = new ClassificationService(prismaMock({ update }));
      await service.apply('evt-1', { category: 'music_audio', subCategory: null });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { category: 'music_audio', subCategory: null },
      });
    });
  });

  describe('metadataString', () => {
    const service = new ClassificationService(prismaMock());
    it('handles non-object and empty metadata', () => {
      expect(service.metadataString(null, 'url')).toBeNull();
      expect(service.metadataString('legend', 'url')).toBeNull();
      expect(service.metadataString(['x'], 'url')).toBeNull();
    });
    it('reads string fields only', () => {
      expect(service.metadataString({ url: 'https://a.b', title: 42 }, 'url')).toBe('https://a.b');
      expect(service.metadataString({ url: 'https://a.b' }, 'title')).toBeNull();
    });
  });
});
