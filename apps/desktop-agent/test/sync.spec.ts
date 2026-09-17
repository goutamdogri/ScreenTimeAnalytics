import type { RawEventPayload } from '@screen-time/core';

import { ApiError, ApiClient } from '../src/api-client';
import type { IngestResponse } from '../src/sync';
import { SyncEngine } from '../src/sync';
import type { AgentConfig } from '../src/config';
import { EventBuffer } from '../src/buffer';
import { SILENT_LOGGER } from '../src/logger';
import { focusEvent } from '../src/event-builder';

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    apiBaseUrl: 'http://api.test',
    deviceName: 'test-pc',
    platform: 'linux-x11',
    pollIntervalMs: 1,
    idleThresholdMs: 1000,
    syncIntervalMs: 10000,
    syncBatchSize: 50,
    spoolDir: '/tmp',
    configDir: '/tmp',
    localServerPort: null,
    ...overrides,
  };
}

async function withSpool<T>(fn: (buffer: EventBuffer) => Promise<T>): Promise<T> {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'sta-sync-'));
  try {
    return await fn(new EventBuffer(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface FakeApiCall {
  path: string;
  headers?: Record<string, string>;
  json?: unknown;
}

function fakeApi(
  handler: (call: FakeApiCall) => Promise<{ status: number; body: unknown }>,
): ApiClient {
  return {
    async request(path: string, opts: { headers?: Record<string, string>; json?: unknown } = {}) {
      const res = await handler({ path, headers: opts.headers, json: opts.json });
      if (res.status >= 400) throw new ApiError('http', res.status, `HTTP ${res.status}`, false);
      return { status: res.status, ok: true, body: res.body as never };
    },
  } as unknown as ApiClient;
}

function event(ts: string): RawEventPayload {
  return focusEvent(new Date(ts).toISOString(), { title: 'Terminal', processName: 'alacritty' });
}

const fixedNow = new Date('2026-02-01T00:00:00.000Z');

describe('SyncEngine', () => {
  it('sends a batch and trims the spool on success', async () => {
    await withSpool(async (buffer) => {
      await buffer.append(event('2026-02-01T00:00:00.000Z'));
      await buffer.append(event('2026-02-01T00:00:01.000Z'));

      const seen: FakeApiCall[] = [];
      const api = fakeApi(async (call) => {
        seen.push(call);
        return { status: 200, body: { accepted: 2, duplicates: 0 } };
      });

      const engine = new SyncEngine({
        api,
        buffer,
        deviceToken: 'tok',
        config: makeConfig(),
        logger: SILENT_LOGGER,
        now: () => fixedNow,
      });
      await engine.flush();

      expect(seen).toHaveLength(1);
      const call = seen[0] as FakeApiCall;
      const body = call.json as { events: RawEventPayload[] };
      expect(body.events).toHaveLength(2);
      expect(call.path).toBe('/events');
      expect(call.headers?.['x-device-token']).toBe('tok');
      expect(await buffer.count()).toBe(0);
    });
  });

  it('keeps the spool and backs off when the backend is down', async () => {
    await withSpool(async (buffer) => {
      await buffer.append(event('2026-02-01T00:00:00.000Z'));

      let calls = 0;
      const api = fakeApi(async () => {
        calls++;
        throw new ApiError('network', 0, 'ECONNREFUSED', true);
      });

      const engine = new SyncEngine({
        api,
        buffer,
        deviceToken: 'tok',
        config: makeConfig(),
        logger: SILENT_LOGGER,
        now: () => fixedNow,
      });
      await engine.flush();
      await engine.flush();

      expect(calls).toBe(2);
      expect(await buffer.count()).toBe(1);
      expect((engine as unknown as { backoffMs: number }).backoffMs).toBeGreaterThanOrEqual(5000);
    });
  });

  it('does not resend a batch that was already trimmed on a reflush of a 4xx', async () => {
    await withSpool(async (buffer) => {
      await buffer.append(event('2026-02-01T00:00:00.000Z'));
      let calls = 0;
      const api = fakeApi(async () => {
        calls++;
        if (calls === 1) return { status: 400, body: { accepted: 0, duplicates: 1 } };
        return { status: 200, body: { accepted: 1, duplicates: 0 } };
      });
      const engine = new SyncEngine({
        api,
        buffer,
        deviceToken: 'tok',
        config: makeConfig(),
        logger: SILENT_LOGGER,
        now: () => fixedNow,
      });
      await engine.flush();
      await engine.flush();
      expect(calls).toBe(2);
    });
  });

  it('start() schedules an immediate flush', async () => {
    await withSpool(async (buffer) => {
      await buffer.append(event('2026-02-01T00:00:00.000Z'));
      const api = fakeApi(async () => ({
        status: 200,
        body: { accepted: 1, duplicates: 0 } as IngestResponse,
      }));
      const engine = new SyncEngine({
        api,
        buffer,
        deviceToken: 'tok',
        config: makeConfig(),
        logger: SILENT_LOGGER,
        now: () => fixedNow,
      });
      engine.start();
      let count = 1;
      const deadline = Date.now() + 1000;
      while (count !== 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
        count = await buffer.count();
      }
      engine.stop();
      expect(count).toBe(0);
    });
  });
});
