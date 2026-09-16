import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
  const DAY_START = new Date('2026-09-16T00:00:00.000Z');
  const DAY_END = new Date('2026-09-17T00:00:00.000Z');

  const buildPrisma = (sequence: unknown[][]) => {
    const mock = jest.fn<Promise<unknown[]>, [unknown]>();
    for (const value of sequence) {
      mock.mockResolvedValueOnce(value);
    }
    return { $queryRaw: mock };
  };

  describe('getSummary', () => {
    it('aggregates totals, intentionality split, categories, sessions and devices', async () => {
      const prismaMock = buildPrisma([
        [{ start: DAY_START, end: DAY_END }],
        [{ minutes: 120 }],
        [
          { category: 'deep_work', minutes: 80 },
          { category: 'social_media', minutes: 30 },
          { category: 'music_audio', minutes: 10 },
        ],
        [{ count: 12 }],
        [{ count: 1 }],
      ]);
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
      expect(result.sessionCount).toBe(12);
      expect(result.activeDevices).toBe(1);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(5);
    });

    it('classifies idle_afk as excluded from the totals split', async () => {
      const prismaMock = buildPrisma([
        [{ start: DAY_START, end: DAY_END }],
        [{ minutes: 0 }],
        [
          { category: 'deep_work', minutes: 0 },
          { category: 'idle_afk', minutes: 240 },
        ],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSummary(FAKE_USER_ID, '2026-09-16', 'UTC');

      expect(result.totalMinutes).toBe(0);
      expect(result.focusMinutes).toBe(0);
      expect(result.byCategory).toEqual([
        { category: 'deep_work', minutes: 0, share: 0 },
        { category: 'idle_afk', minutes: 240, share: 0 },
      ]);
    });

    it('returns zeros when no events exist', async () => {
      const prismaMock = buildPrisma([
        [{ start: DAY_START, end: DAY_END }],
        [{ minutes: 0 }],
        [],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
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
      const prismaMock = buildPrisma([
        [{ start: new Date('2026-09-09T00:00:00.000Z') }],
        [{ now: new Date('2026-09-16T12:00:00.000Z') }],
        [
          { day: '2026-09-15', category: 'deep_work', minutes: 90 },
          { day: '2026-09-15', category: 'social_media', minutes: 45 },
          { day: '2026-09-16', category: 'deep_work', minutes: 60 },
        ],
      ]);
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
      const prismaMock = buildPrisma([
        [{ start: new Date('2026-09-09T00:00:00.000Z') }],
        [{ now: new Date('2026-09-16T12:00:00.000Z') }],
        [
          { category: 'deep_work', minutes: 200 },
          { category: 'music_audio', minutes: 80 },
        ],
        [
          { app: 'code', category: 'deep_work', minutes: 150 },
          { app: 'vim', category: 'deep_work', minutes: 50 },
          { app: 'spotify', category: 'music_audio', minutes: 80 },
        ],
      ]);
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
    it('segments focus events into sessions on gaps longer than 5 minutes', async () => {
      const prismaMock = buildPrisma([
        [
          {
            timestamp: new Date('2026-09-16T10:00:00.000Z'),
            app: 'code',
            window_title: 'schema.prisma',
            category: 'deep_work',
            source: 'x11',
          },
          {
            timestamp: new Date('2026-09-16T10:04:00.000Z'),
            app: 'code',
            window_title: 'schema.prisma',
            category: 'deep_work',
            source: 'x11',
          },
          {
            timestamp: new Date('2026-09-16T10:12:00.000Z'),
            app: 'slack',
            window_title: '#general',
            category: 'communication',
            source: 'x11',
          },
        ],
      ]);
      const service = new DashboardService(prismaMock as any);

      const result = await service.getSessions(
        FAKE_USER_ID,
        '2026-09-16T00:00:00Z',
        '2026-09-17T00:00:00Z',
      );

      const [codeSession, slackSession] = result;
      expect(result).toHaveLength(2);
      expect(codeSession).toMatchObject({
        app: 'code',
        category: 'deep_work',
        durationMin: 4,
      });
      expect(codeSession?.startedAt).toEqual(new Date('2026-09-16T10:00:00.000Z'));
      expect(codeSession?.endedAt).toEqual(new Date('2026-09-16T10:04:00.000Z'));
      expect(slackSession).toMatchObject({
        app: 'slack',
        category: 'communication',
      });
    });

    it('returns an empty array when no focus events exist', async () => {
      const prismaMock = buildPrisma([[]]);
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
