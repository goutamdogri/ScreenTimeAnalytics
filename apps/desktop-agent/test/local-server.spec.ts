import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RawEventPayload } from '@screen-time/core';

import { EventBuffer } from '../src/buffer';
import { LocalServer } from '../src/local-server';
import { SILENT_LOGGER } from '../src/logger';

async function withServer(
  fn: (opts: { server: LocalServer; buffer: EventBuffer; port: number }) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'sta-local-'));
  const buffer = new EventBuffer(dir);
  const server = new LocalServer({ port: 0, buffer, logger: SILENT_LOGGER });
  await server.start();
  const { port } = (
    server as unknown as { server: { address(): { port: number } } }
  ).server.address();
  try {
    await fn({ server, buffer, port });
  } finally {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
}

describe('LocalServer', () => {
  it('POST /event buffers a browse event and returns 202', async () => {
    await withServer(async ({ buffer, port }) => {
      const res = await fetch(`http://127.0.0.1:${port}/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/docs', title: 'Docs' }),
      });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ accepted: true });
      expect(await buffer.count()).toBe(1);
      const [ev] = await buffer.peek(1);
      const event = ev as RawEventPayload;
      expect(event).toMatchObject({ source: 'extension', eventType: 'browse', app: 'browser' });
      expect(event.metadata).toMatchObject({ url: 'https://example.com/docs', title: 'Docs' });
    });
  });

  it('rejects payloads without url or title', async () => {
    await withServer(async ({ buffer, port }) => {
      const res = await fetch(`http://127.0.0.1:${port}/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(await buffer.count()).toBe(0);
    });
  });

  it('rejects invalid JSON', async () => {
    await withServer(async ({ port }) => {
      const res = await fetch(`http://127.0.0.1:${port}/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      expect(res.status).toBe(400);
    });
  });

  it('GET /health reports ok', async () => {
    await withServer(async ({ port }) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });
});
