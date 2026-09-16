import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrap } from '../src/main';

jest.setTimeout(30_000);

describe('events (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let deviceToken: string;

  const email = `e2e-events-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Str0ng!Passw0rd';

  const timestampA = '2026-09-15T10:00:00.000Z';
  const timestampB = '2026-09-15T10:00:01.000Z';

  const batch = [
    {
      timestamp: timestampA,
      source: 'x11',
      eventType: 'focus',
      app: 'code',
      windowTitle: 'schema.prisma',
    },
    {
      timestamp: timestampB,
      source: 'mpris',
      eventType: 'media',
      app: 'spotify',
      windowTitle: 'Blinding Lights',
      metadata: { artist: 'The Weeknd', durationSeconds: 200 },
    },
  ];

  beforeAll(async () => {
    process.env.PORT = '0';
    app = await bootstrap();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('setup: register user + device to obtain a device token', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    accessToken = register.body.tokens.accessToken;

    const device = await request(app.getHttpServer())
      .post('/devices/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Events E2E Device', platform: 'linux-x11' })
      .expect(201);
    deviceToken = device.body.deviceToken;
  });

  it('POST /events → 201 accepts a fresh batch', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({ events: batch })
      .expect(201);

    expect(res.body).toEqual({ accepted: 2, duplicates: 0 });
  });

  it('POST /events (same batch) → 201 reports duplicates, dedupes on (device, timestamp, source)', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({ events: batch })
      .expect(201);

    expect(res.body).toEqual({ accepted: 0, duplicates: 2 });
  });

  it('POST /events with a new event in the batch only accepts the new one', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({
        events: [
          ...batch,
          {
            timestamp: '2026-09-15T10:00:02.000Z',
            source: 'extension',
            eventType: 'browse',
            app: 'firefox',
            windowTitle: 'MDN Web Docs',
            url: 'https://developer.mozilla.org/en-US/',
          },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({ accepted: 1, duplicates: 2 });
  });

  it('POST /events (unknown token) → 404', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', '00000000-0000-0000-0000-000000000000')
      .send({ events: [] })
      .expect(404);
  });

  it('POST /events (invalid source) → 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({
        events: [
          {
            timestamp: timestampA,
            source: 'nfs-remote',
            eventType: 'focus',
          },
        ],
      })
      .expect(400);
  });

  it('POST /events (missing token) → 404', async () => {
    await request(app.getHttpServer()).post('/events').send({ events: batch }).expect(404);
  });
});
