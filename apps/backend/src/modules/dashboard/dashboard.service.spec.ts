import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
  const DAY_START = new Date('2026-09-16T00:00:00.000Z');
  const DAY_END = new Date('2026-09-17T00:00:00.000Z');

  interface PrismaShape {
    queryRaw?: unknown[][];
    sessions?: object[];
  }

  const buildPrisma = (shape: PrismaShape) => {
    const queryRawFn = jest.fn<Promise<unknown[]>, [unknown]>();
    for (const value of shape.queryRaw ?? []) {
      queryRawFn.mockResolvedValueOnce(value);
    }
    const sessionsFn = jest
      .fn<Promise<object[]>, [unknown]>()
      .mockResolvedValue(shape.sessions ?? []);
    return { $queryRaw: queryRawFn, session: { findMany: sessionsFn } };
  };

  describe('getSummary', () => {
    it('aggregates totals, intentionality split, categories, sessions and devices', async () => {
      const prismaMock = buildPrisma({
        queryRaw: [[{ start: DAY_START, end: DAY_END }]],
        sessions: [
          { durationMin: 80, category: 'deep_work', deviceId: 'd1' },
          { durationMin: 30, category: 'social_media', deviceId: 'd1' },
          { durationMin: 10, category: 'music_audio', deviceId: 'd2' },
        ],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSummary(FAKE_USER_ID, '2026-09-16', 'UTC');

      expect(result.totalMinutes).toBe(120);
      expect(result.focusMinutes).toBe(80);
      expect(result.autopilotMinutes).toBe(30);
      expect(result.neutralMinutes).toBe(10);
      expect(result.byCategory).toEqual([
        { category: 'deep_work', minutes: 80, share: 0.6667 },
        { category: 'social_media', minutes: 30, share: 0.25 },
        { category: 'music_audio', minutes: 10, share: 0.0833 },
      ]);
      expect(result.sessionCount).toBe(3);
      expect(result.activeDevices).toBe(2);
    });

    it('classifies idle_afk as excluded from the totals split', async () => {
      const prismaMock = buildPrisma({
        queryRaw: [[{ start: DAY_START, end: DAY_END }]],
        sessions: [
          { durationMin: 0, category: 'deep_work', deviceId: 'd1' },
          { durationMin: 240, category: 'idle_afk', deviceId: 'd1' },
        ],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSummary(FAKE_USER_ID, '2026-09-16', 'UTC');

      expect(result.totalMinutes).toBe(240);
      expect(result.focusMinutes).toBe(0);
      expect(result.byCategory).toEqual([
        { category: 'deep_work', minutes: 0, share: 0 },
        { category: 'idle_afk', minutes: 240, share: 1 },
      ]);
    });

    it('returns zeros when no sessions exist', async () => {
      const prismaMock = buildPrisma({
        queryRaw: [[{ start: DAY_START, end: DAY_END }]],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSummary(FAKE_USER_ID, '2026-09-16', 'UTC');

      expect(result.totalMinutes).toBe(0);
      expect(result.byCategory).toEqual([]);
      expect(result.sessionCount).toBe(0);
      expect(result.activeDevices).toBe(0);
    });
  });

  describe('getTrends', () => {
    it('groups per-day category minutes into day buckets', async () => {
      const prismaMock = buildPrisma({
        queryRaw: [
          [{ start: new Date('2026-09-09T00:00:00.000Z') }],
          [{ now: new Date('2026-09-16T12:00:00.000Z') }],
        ],
        sessions: [
          { startedAt: new Date('2026-09-15T09:00:00Z'), durationMin: 90, category: 'deep_work' },
          {
            startedAt: new Date('2026-09-15T14:00:00Z'),
            durationMin: 45,
            category: 'social_media',
          },
          { startedAt: new Date('2026-09-16T09:00:00Z'), durationMin: 60, category: 'deep_work' },
        ],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getTrends(FAKE_USER_ID, 'week', 'UTC');

      expect(result.range).toBe('week');
      expect(result.days).toHaveLength(2);
      expect(result.days[0]).toEqual({
        date: '2026-09-15',
        totalMinutes: 135,
        byCategory: [
          { category: 'deep_work', minutes: 90 },
          { category: 'social_media', minutes: 45 },
        ],
      });
      expect(result.days[1]).toEqual({
        date: '2026-09-16',
        totalMinutes: 60,
        byCategory: [{ category: 'deep_work', minutes: 60 }],
      });
    });
  });

  describe('getCategories', () => {
    it('computes totals, shares and top apps per category', async () => {
      const prismaMock = buildPrisma({
        queryRaw: [
          [{ start: new Date('2026-09-09T00:00:00.000Z') }],
          [{ now: new Date('2026-09-16T12:00:00.000Z') }],
        ],
        sessions: [
          {
            durationMin: 200,
            category: 'deep_work',
            app: 'code',
            appMinutes: { code: 150, vim: 50 },
          },
          {
            durationMin: 80,
            category: 'music_audio',
            app: 'spotify',
            appMinutes: { spotify: 80 },
          },
        ],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getCategories(FAKE_USER_ID, 'week', 'UTC');

      expect(result.range).toBe('week');
      expect(result.totals).toEqual([
        {
          category: 'deep_work',
          minutes: 200,
          share: 0.7143,
          topApps: [
            { app: 'code', minutes: 150 },
            { app: 'vim', minutes: 50 },
          ],
        },
        {
          category: 'music_audio',
          minutes: 80,
          share: 0.2857,
          topApps: [{ app: 'spotify', minutes: 80 }],
        },
      ]);
    });
  });

  describe('getSessions', () => {
    it('maps persisted closed sessions from the sessions table', async () => {
      const prismaMock = buildPrisma({
        sessions: [
          {
            startedAt: new Date('2026-09-16T10:00:00.000Z'),
            endedAt: new Date('2026-09-16T10:04:00.000Z'),
            durationMin: 4,
            app: 'code',
            windowTitle: 'schema.prisma',
            category: 'deep_work',
            source: 'x11',
          },
          {
            startedAt: new Date('2026-09-16T10:12:00.000Z'),
            endedAt: new Date('2026-09-16T10:12:00.000Z'),
            durationMin: 1,
            app: 'slack',
            windowTitle: '#general',
            category: 'communication',
            source: 'x11',
          },
        ],
      });
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSessions(
        FAKE_USER_ID,
        '2026-09-16T00:00:00Z',
        '2026-09-17T00:00:00Z',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        app: 'code',
        category: 'deep_work',
        durationMin: 4,
      });
      expect(result[0]?.startedAt).toEqual(new Date('2026-09-16T10:00:00.000Z'));
      expect(result[1]).toMatchObject({
        app: 'slack',
        category: 'communication',
      });
    });

    it('returns an empty array when no closed sessions exist', async () => {
      const prismaMock = buildPrisma({});
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSessions(
        FAKE_USER_ID,
        '2026-09-16T00:00:00Z',
        '2026-09-17T00:00:00Z',
      );

      expect(result).toEqual([]);
    });
  });
});
