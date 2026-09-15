import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrap } from '../src/main';

jest.setTimeout(30_000);

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.PORT = '0';
    app = await bootstrap();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('up');
        expect(typeof res.body.uptimeSeconds).toBe('number');
      });
  });
});
