import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrap } from '../src/main';

jest.setTimeout(30_000);

describe('auth & devices (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let deviceId: string;
  let deviceToken: string;

  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Str0ng!Passw0rd';

  beforeAll(async () => {
    process.env.PORT = '0';
    app = await bootstrap();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register → 201 user + tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    userId = res.body.user.id;
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('POST /auth/login → 200 user + tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.user.id).toBe(userId);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
  });

  it('POST /auth/me → 200 returns authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.user.userId).toBe(userId);
  });

  it('POST /auth/refresh → rotates refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.tokens.refreshToken).toBeDefined();
    expect(res.body.tokens.refreshToken).not.toBe(refreshToken);

    // old refresh should now be rejected
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);

    refreshToken = res.body.tokens.refreshToken;
  });

  it('POST /auth/logout → revoke + refresh → 401', async () => {
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(200);

    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  // --- Devices ---

  it('POST /devices/register → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test Device', platform: 'linux-x11' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.deviceToken).toBeDefined();
    deviceId = res.body.id;
    deviceToken = res.body.deviceToken;
  });

  it('GET /devices → 200 array with one entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(deviceId);
  });

  it('PATCH /devices/:id → updates name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Device' })
      .expect(200);

    expect(res.body.name).toBe('Updated Device');
  });

  it('POST /devices/heartbeat (valid token) → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices/heartbeat')
      .set('x-device-token', deviceToken)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('POST /devices/heartbeat (unknown token) → 404', async () => {
    await request(app.getHttpServer())
      .post('/devices/heartbeat')
      .set('x-device-token', '00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('DELETE /devices/:id → 204', async () => {
    await request(app.getHttpServer())
      .delete(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
