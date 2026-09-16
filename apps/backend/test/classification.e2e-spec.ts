import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { bootstrap } from '../src/main';

jest.setTimeout(30_000);

describe('llm config & rule classification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let deviceToken: string;

  const email = `e2e-llm-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Str0ng!Passw0rd';
  const apiKey = 'sk-e2e-super-secret-123';

  const BASE = 'https://github.com/screen-time/test-repo';
  const SHORTS = 'https://www.youtube.com/shorts/xyz123';
  // A long-form video URL matches no rule and is a content-layer candidate for
  // the async worker (its category stays NULL until an LLM enriches it).
  const LONG_FORM = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  beforeAll(async () => {
    process.env.PORT = '0';
    app = await bootstrap();
    prisma = app.get(PrismaService);
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
      .send({ name: 'LLM E2E Device', platform: 'linux-x11' })
      .expect(201);
    deviceToken = device.body.deviceToken;
  });

  it('GET /llm/providers requires auth', async () => {
    await request(app.getHttpServer()).get('/llm/providers').expect(401);
  });

  it('GET /llm/providers lists local + cloud providers without leaking keys', async () => {
    const res = await request(app.getHttpServer())
      .get('/llm/providers')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const ids = res.body.cloud.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'groq', 'gemini']));
    expect(res.body.cloud.items.some((i: { id: string }) => i.id === 'ollama')).toBe(false);
    expect(res.body.local).toHaveProperty('available');
    expect(res.body.local).toHaveProperty('models');
    expect(JSON.stringify(res.body)).not.toContain(apiKey);
  });

  it('GET /llm/config → 404 before any configuration exists', async () => {
    await request(app.getHttpServer())
      .get('/llm/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('PUT /llm/config stores an encrypted key and never echoes it', async () => {
    const res = await request(app.getHttpServer())
      .put('/llm/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'groq', model: 'llama-3.1-8b-instant', apiKey })
      .expect(200);

    expect(res.body).toMatchObject({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      hasApiKey: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('sk-e2e');
    expect(res.body.updatedAt).toEqual(expect.any(String));

    // Encrypted, not plaintext, at rest.
    const stored = await prisma.llmConfig.findFirst();
    expect(stored?.encryptedApiKey).not.toBeNull();
    expect(stored?.encryptedApiKey).not.toContain('sk-e2e');
  });

  it('PUT /llm/config without apiKey keeps the previously stored key', async () => {
    await request(app.getHttpServer())
      .put('/llm/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'groq', model: 'llama-3.1-8b-instant' })
      .expect(200);

    const stored = await prisma.llmConfig.findFirst();
    expect(stored?.encryptedApiKey).not.toBeNull();
  });

  it('DELETE /llm/config clears settings (rule-only mode)', async () => {
    await request(app.getHttpServer())
      .delete('/llm/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/llm/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('ingest classifies rules synchronously and leaves content-layer candidates for the worker', async () => {
    // The e2e DB is persistent across runs — drop any rows from previous runs.
    await prisma.rawEvent.deleteMany({ where: { url: { in: [BASE, SHORTS, LONG_FORM] } } });

    await request(app.getHttpServer())
      .post('/events')
      .set('x-device-token', deviceToken)
      .send({
        events: [
          {
            timestamp: '2026-09-15T10:00:00.000Z',
            source: 'extension',
            eventType: 'browse',
            url: BASE,
          },
          {
            timestamp: '2026-09-15T10:00:01.000Z',
            source: 'extension',
            eventType: 'browse',
            url: SHORTS,
          },
          {
            timestamp: '2026-09-15T10:00:02.000Z',
            source: 'extension',
            eventType: 'browse',
            url: LONG_FORM,
          },
        ],
      })
      .expect(201)
      .expect((res) => expect(res.body).toMatchObject({ accepted: 3, duplicates: 0 }));

    const rows = await prisma.rawEvent.findMany({
      where: { url: { in: [BASE, SHORTS, LONG_FORM] } },
      orderBy: { timestamp: 'asc' },
    });
    expect(rows.map((r) => r.url)).toEqual([BASE, SHORTS, LONG_FORM]);
    expect(rows.map((r) => r.category)).toEqual(['deep_work', 'short_form_video', null]);
    expect(rows.every((r) => r.subCategory === null)).toBe(true);
  });
});
