import { EventsService } from './events.service';
import { ClassificationService } from '../classification/classification.service';

describe('EventsService', () => {
  const DEVICE_ID = '00000000-0000-0000-0000-000000000001';

  // classify() is a pure function that never touches Prisma, so the same mock
  // backs both dependencies: the real rule engine runs in these tests.
  type CreateManyArgs = { data: Array<{ category: string | null; metadata?: unknown }> };
  const prismaMock = (createMany: unknown) => ({ rawEvent: { createMany } }) as any;
  const classification = new ClassificationService(prismaMock(jest.fn()));

  describe('ingest', () => {
    it('returns accepted + duplicates counts for a deduped batch', async () => {
      const createMany = jest
        .fn<Promise<{ count: number }>, [args: CreateManyArgs]>()
        .mockResolvedValue({ count: 2 });
      const service = new EventsService(prismaMock(createMany), classification);
      const result = await service.ingest(DEVICE_ID, [
        {
          timestamp: '2026-09-15T10:00:00.000Z',
          source: 'x11',
          eventType: 'focus',
          app: 'code',
          windowTitle: 'schema.prisma',
        },
        {
          timestamp: '2026-09-15T10:00:05.000Z',
          source: 'x11',
          eventType: 'focus',
          app: 'code',
          windowTitle: 'README.md',
        },
        {
          timestamp: '2026-09-15T10:00:05.000Z',
          source: 'x11',
          eventType: 'focus',
          app: 'code',
          windowTitle: 'README.md',
        },
      ]);
      expect(result).toEqual({ accepted: 2, duplicates: 1 });
      expect(createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              deviceId: DEVICE_ID,
              source: 'x11',
              eventType: 'focus',
              timestamp: expect.any(Date),
            }),
          ]),
        }),
      );
    });

    it('stores the rule-based category synchronously at ingest', async () => {
      const createMany = jest
        .fn<Promise<{ count: number }>, [args: CreateManyArgs]>()
        .mockResolvedValue({ count: 3 });
      const service = new EventsService(prismaMock(createMany), classification);
      await service.ingest(DEVICE_ID, [
        { timestamp: '2026-09-15T10:00:00.000Z', source: 'x11', eventType: 'focus', app: 'code' },
        {
          timestamp: '2026-09-15T10:00:01.000Z',
          source: 'mpris',
          eventType: 'media',
          app: 'spotify',
        },
        {
          timestamp: '2026-09-15T10:00:02.000Z',
          source: 'extension',
          eventType: 'browse',
          url: 'https://github.com/user/repo',
        },
      ]);
      const data = createMany.mock.calls[0]![0].data as {
        category: string | null;
        subCategory: string | null;
      }[];
      expect(data.map((d) => d.category)).toEqual(['deep_work', 'music_audio', 'deep_work']);
      expect(data.every((d) => d.subCategory === null)).toBe(true);
    });

    it('leaves rule-missed events uncategorized for the content layer', async () => {
      const createMany = jest
        .fn<Promise<{ count: number }>, [args: CreateManyArgs]>()
        .mockResolvedValue({ count: 1 });
      const service = new EventsService(prismaMock(createMany), classification);
      await service.ingest(DEVICE_ID, [
        {
          timestamp: '2026-09-15T10:00:00.000Z',
          source: 'x11',
          eventType: 'focus',
          app: 'mystery-app',
        },
      ]);
      expect(createMany.mock.calls[0]![0].data[0]!.category).toBeNull();
    });

    it('maps optional metadata into the payload', async () => {
      const createMany = jest
        .fn<Promise<{ count: number }>, [args: CreateManyArgs]>()
        .mockResolvedValue({ count: 1 });
      const service = new EventsService(prismaMock(createMany), classification);
      await service.ingest(DEVICE_ID, [
        {
          timestamp: '2026-09-15T12:00:00.000Z',
          source: 'mpris',
          eventType: 'media',
          app: 'spotify',
          windowTitle: 'Blinding Lights',
          metadata: { artist: 'The Weeknd', durationSeconds: 200 },
        },
      ]);
      const call = createMany.mock.calls[0]![0];
      expect(call.data[0]!.metadata).toEqual({ artist: 'The Weeknd', durationSeconds: 200 });
    });

    it('returns zeroes for an empty batch without touching the DB', async () => {
      const createMany = jest.fn();
      const service = new EventsService(prismaMock(createMany), classification);
      const result = await service.ingest(DEVICE_ID, []);
      expect(result).toEqual({ accepted: 0, duplicates: 0 });
      expect(createMany).not.toHaveBeenCalled();
    });
  });
});
