import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrap } from '../src/main';

jest.setTimeout(30_000);

describe('dashboard (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let deviceToken: string;

  const email = `e2e-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Str0ng!Passw0rd';

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const toISO = (minutesAgo: number): string =>
    new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

  // Three focus events one minute apart: code (deep_work), slack (communication),
  // spotify (music_audio) — all inside the same 5-minute session.
  const focusBatch = [
    {
      timestamp: toISO(9),
      source: 'x11',
      eventType: 'focus',
      app: 'code',
      windowTitle: 'schema.prisma',
    },
    {
      timestamp: toISO(8),
      source: 'x11',
      eventType: 'focus',
      app: 'slack',
      windowTitle: '#general',
    },
    {
      timestamp: toISO(7),
      source: 'x11',
      eventType: 'focus',
      app: 'spotify',
      windowTitle: 'Blinding Lights',
    },
  ];

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
      .send({ name: 'Dashboard E2E Device', platform: 'linux-x11' })
      .expect(201);
    deviceToken = device.body.deviceToken;
  });

  it('seed: ingest three categorized focus events', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({ events: focusBatch })
      .expect(201);
    expect(res.body).toEqual({ accepted: 3, duplicates: 0 });
  });

  it('GET /dashboard/summary → totals, intentionality split, categories', async () => {
    const res = await request(app.getHttpServer())
      .get(`/dashboard/summary?date=${today}&tz=UTC`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.date).toBe(today);
    expect(res.body.totalMinutes).toBeGreaterThanOrEqual(3);
    expect(res.body.focusMinutes).toBeGreaterThanOrEqual(1);
    expect(res.body.neutralMinutes).toBeGreaterThanOrEqual(2);
    expect(res.body.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'deep_work' }),
        expect.objectContaining({ category: 'communication' }),
        expect.objectContaining({ category: 'music_audio' }),
      ]),
    );
    expect(res.body.sessionCount).toBeGreaterThan(0);
    expect(res.body.activeDevices).toBe(1);
  });

  it('GET /dashboard/trends?range=week → includes today with deep_work minutes', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/trends?range=week&tz=UTC')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.range).toBe('week');
    const day = res.body.days.find((d: { date: string }) => d.date === today);
    expect(day).toBeDefined();
    expect(day.byCategory).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'deep_work' })]),
    );
  });

  it('GET /dashboard/categories?range=week → per-category totals with top apps', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/categories?range=week&tz=UTC')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.range).toBe('week');
    const deepWork = res.body.totals.find((t: { category: string }) => t.category === 'deep_work');
    expect(deepWork).toBeDefined();
    expect(deepWork.topApps).toEqual(
      expect.arrayContaining([expect.objectContaining({ app: 'code' })]),
    );
  });

  it('GET /dashboard/sessions → derives a session holding the ingested focus events', async () => {
    const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/dashboard/sessions?from=${from}&to=${now.toISOString()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const codeSession = res.body.sessions.find((s: { app: string }) => s.app === 'code');
    expect(codeSession).toBeDefined();
    expect(codeSession.category).toBe('deep_work');
    expect(codeSession.durationMin).toBeGreaterThanOrEqual(1);
  });

  it('GET /dashboard/summary without token → 401', async () => {
    await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
  });

  it('GET /dashboard/trends with invalid range → 400', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/trends?range=decade')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });
});
