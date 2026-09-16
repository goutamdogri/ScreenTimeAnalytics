import { EventsService } from './events.service';

describe('EventsService', () => {
  const DEVICE_ID = '00000000-0000-0000-0000-000000000001';

  const prismaMock = (createMany: jest.Mock) => ({ rawEvent: { createMany } }) as any;

  describe('ingest', () => {
    it('returns accepted + duplicates counts for a deduped batch', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 2 });
      const service = new EventsService(prismaMock(createMany));
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

    it('maps optional metadata into the payload', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 1 });
      const service = new EventsService(prismaMock(createMany));
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
      const call = createMany.mock.calls[0][0];
      expect(call.data[0].metadata).toEqual({ artist: 'The Weeknd', durationSeconds: 200 });
    });

    it('returns zeroes for an empty batch without touching the DB', async () => {
      const createMany = jest.fn();
      const service = new EventsService(prismaMock(createMany));
      const result = await service.ingest(DEVICE_ID, []);
      expect(result).toEqual({ accepted: 0, duplicates: 0 });
      expect(createMany).not.toHaveBeenCalled();
    });
  });
});
