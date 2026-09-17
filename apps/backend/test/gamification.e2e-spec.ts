import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrap } from '../src/main';
import { SessionsFinalizerService } from '../src/modules/sessions/sessions.finalizer.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(30_000);

describe('gamification (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let deviceToken: string;

  const email = `e2e-gamification-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Str0ng!Passw0rd';

  const now = new Date();
  const toISO = (minutesAgo: number): string =>
    new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

  // Six `code` events 4 minutes apart → one 20-minute deep_work window, plus a
  // lone short-form event that breaks the "clean day" (autopilot).
  const deepWorkBatch = Array.from({ length: 6 }, (_, i) => ({
    timestamp: toISO(60 - i * 4),
    source: 'x11',
    eventType: 'focus',
    app: 'code',
    windowTitle: 'src/index.ts',
  }));

  const shortFormBatch = [
    {
      timestamp: toISO(20),
      source: 'extension',
      eventType: 'focus',
      app: 'chrome',
      url: 'https://www.instagram.com/reels/CbxYZ/',
      windowTitle: '',
    },
  ];

  async function finalize(): Promise<void> {
    const prisma = app.get(PrismaService);
    const finalizer = app.get(SessionsFinalizerService);
    const device = await prisma.device.findFirst({ where: { deviceToken }, select: { id: true } });
    await finalizer.finalizeDevice(device!.id);
  }

  beforeAll(async () => {
    process.env.PORT = '0';
    app = await bootstrap();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('setup: register user + device', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    accessToken = register.body.tokens.accessToken;

    const device = await request(app.getHttpServer())
      .post('/devices/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Gamification E2E Device', platform: 'linux-x11' })
      .expect(201);
    deviceToken = device.body.deviceToken;
  });

  it('seed: ingest a qualifying deep-work session and a short-form event', async () => {
    const deepWork = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({ events: deepWorkBatch })
      .expect(201);
    expect(deepWork.body.accepted).toBe(deepWorkBatch.length);

    const shortForm = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({ events: shortFormBatch })
      .expect(201);
    expect(shortForm.body.accepted).toBe(1);
  });

  it('finalize → closed session + gamification settled in the same transaction', async () => {
    await finalize();

    const prisma = app.get(PrismaService);
    const sessions = await prisma.session.findMany({
      where: { device: { deviceToken }, status: 'closed' },
      orderBy: { startedAt: 'asc' },
    });
    expect(sessions).toHaveLength(2);
    const deepWork = sessions.find((s) => s.category === 'deep_work')!;
    expect(deepWork.durationMin).toBeGreaterThanOrEqual(20);
    expect(deepWork.status).toBe('closed');
    expect(deepWork.pending).toBeNull();

    const state = await request(app.getHttpServer())
      .get('/gamification/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(state.body.stats.focus).toBeGreaterThanOrEqual(20);
    expect(state.body.stats.discipline).toBeGreaterThanOrEqual(10);
    // 25 (session) + 40 (deep_work_target) + 10 (first_deep_work).
    expect(state.body.xp).toBeGreaterThanOrEqual(75);
    expect(state.body.streakDays).toBeGreaterThanOrEqual(1);
  });

  it('re-finalizing is idempotent — no double XP, no duplicate sessions', async () => {
    const before = await request(app.getHttpServer())
      .get('/gamification/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await finalize();

    const prisma = app.get(PrismaService);
    const sessions = await prisma.session.count({
      where: { device: { deviceToken }, status: 'closed' },
    });
    expect(sessions).toBe(2);

    const after = await request(app.getHttpServer())
      .get('/gamification/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.xp).toBe(before.body.xp);
  });

  it('GET /gamification/quests → daily quests + weekly boss', async () => {
    const res = await request(app.getHttpServer())
      .get('/gamification/quests')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const keys = res.body.dailyQuests.map((q: { key: string }) => q.key);
    expect(keys).toEqual(
      expect.arrayContaining(['deep_work_target', 'deep_work_block', 'no_short_form']),
    );

    const target = res.body.dailyQuests.find((q: { key: string }) => q.key === 'deep_work_target');
    expect(target.progress).toBeGreaterThanOrEqual(20);
    expect(target.completed).toBe(true);

    // Short-form was present, so the "no doomscroll" quest must be incomplete.
    const noShortForm = res.body.dailyQuests.find(
      (q: { key: string }) => q.key === 'no_short_form',
    );
    expect(noShortForm.completed).toBe(false);

    expect(res.body.weeklyBoss.key).toBe('weekly_boss');
    expect(res.body.weeklyBoss.target).toBeGreaterThanOrEqual(180);
    expect(res.body.weeklyBoss.hp).toBeGreaterThanOrEqual(0);
    expect(res.body.weeklyBoss.hp).toBeLessThanOrEqual(100);
  });

  it('GET /gamification/achievements → first_deep_work unlocked', async () => {
    const res = await request(app.getHttpServer())
      .get('/gamification/achievements')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.achievements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'first_deep_work', title: 'First deep block' }),
      ]),
    );
  });

  it('GET /gamification/leaderboard → this week reflects the deep-work minutes', async () => {
    const res = await request(app.getHttpServer())
      .get('/gamification/leaderboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.currentWeek.focusMinutes).toBeGreaterThanOrEqual(20);
    expect(res.body.currentMonth.focusMinutes).toBeGreaterThanOrEqual(20);
    expect('weeklyBest' in res.body).toBe(true);
    expect('monthlyBest' in res.body).toBe(true);
  });

  it('GET /gamification/state without token → 401', async () => {
    await request(app.getHttpServer()).get('/gamification/state').expect(401);
  });
});
