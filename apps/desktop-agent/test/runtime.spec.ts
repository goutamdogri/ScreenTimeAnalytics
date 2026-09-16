import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  ActiveWindowInfo,
  NowPlayingInfo,
  IdleListener,
  MediaListener,
} from '@screen-time/adapters';
import type { RawEventPayload } from '@screen-time/core';

import { ApiError } from '../src/api-client';
import { EventBuffer } from '../src/buffer';
import { type AgentConfig } from '../src/config';
import { SILENT_LOGGER } from '../src/logger';
import { AgentApp } from '../src/runtime';
import type { AgentStore } from '../src/store';

const NOW = new Date('2026-02-01T10:00:00.000Z');

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    apiBaseUrl: 'http://api.test',
    deviceName: 'test-pc',
    platform: 'linux-x11',
    pollIntervalMs: 100,
    idleThresholdMs: 1000,
    syncIntervalMs: 1000,
    syncBatchSize: 50,
    spoolDir: '/tmp',
    configDir: '/tmp',
    localServerPort: null,
    ...overrides,
  };
}

class InMemoryStore implements AgentStore {
  data: Record<string, unknown> = {};
  async load(): Promise<Record<string, unknown>> {
    return { ...this.data };
  }
  async save(data: Record<string, unknown>): Promise<void> {
    this.data = { ...data };
  }
}

interface FakeApiCall {
  path: string;
  headers?: Record<string, string>;
  json?: unknown;
}

function makeApiStub(handler: (call: FakeApiCall) => Promise<{ status: number; body: unknown }>) {
  return {
    async request<T>(
      path: string,
      opts: { headers?: Record<string, string>; json?: unknown } = {},
    ) {
      const res = await handler({ path, headers: opts.headers, json: opts.json });
      if (res.status >= 400) throw new ApiError('http', res.status, `HTTP ${res.status}`, false);
      return { status: res.status, ok: true, body: res.body as T };
    },
  } as never;
}

class FakeX11 {
  private idleCbs: IdleListener[] = [];
  private mediaCbs: MediaListener[] = [];
  window: ActiveWindowInfo | null = null;
  start(): void {}
  dispose(): void {}
  getActiveWindow(): ActiveWindowInfo | null {
    return this.window;
  }
  onIdleChanged(cb: IdleListener): void {
    this.idleCbs.push(cb);
  }
  onMediaChanged(cb: MediaListener): void {
    this.mediaCbs.push(cb);
  }
  emitIdle(idle: boolean): void {
    for (const cb of this.idleCbs) cb(idle);
  }
}

class FakeMpris {
  private mediaCbs: MediaListener[] = [];
  start(): void {}
  dispose(): void {}
  getActiveWindow(): null {
    return null;
  }
  onIdleChanged(): void {}
  onMediaChanged(cb: MediaListener): void {
    this.mediaCbs.push(cb);
  }
  emitMedia(np: NowPlayingInfo | null): void {
    for (const cb of this.mediaCbs) cb(np);
  }
}

async function waitFor(cond: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out waiting for condition');
}

describe('AgentApp', () => {
  it('registers + captures focus/idle/media and syncs them with the device token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sta-app-'));
    const buffer = new EventBuffer(dir);
    const store = new InMemoryStore();
    await store.save({ accessToken: 'at-1', refreshToken: 'rt-1', userId: 'u-1', email: 'u@test' });

    const x11 = new FakeX11();
    const mpris = new FakeMpris();
    const calls: FakeApiCall[] = [];
    const api = makeApiStub(async (call) => {
      calls.push(call);
      if (call.path === '/devices/register') {
        return {
          status: 201,
          body: {
            id: 'dev-1',
            name: 'test-pc',
            platform: 'linux-x11',
            deviceToken: 'tok-1',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
        };
      }
      if (call.path === '/events') {
        const body = call.json as { events: RawEventPayload[] };
        return { status: 201, body: { accepted: body.events.length, duplicates: 0 } };
      }
      if (call.path === '/devices/heartbeat') {
        return { status: 201, body: {} };
      }
      return { status: 404, body: { error: 'not found' } };
    });

    const config = makeConfig({ pollIntervalMs: 20, syncIntervalMs: 100 });
    const app = new AgentApp({
      config,
      logger: SILENT_LOGGER,
      store: store as never,
      api: api as never,
      buffer,
      adapters: async () => ({ x11: x11 as never, mpris: mpris as never }),
      now: () => NOW,
    });

    try {
      const { deviceId } = await app.start();
      expect(deviceId).toBe('dev-1');

      // first capture tick (window now known) → focus event
      x11.window = { title: 'Terminal', processName: 'alacritty' };
      await waitFor(async () => (await buffer.count()) >= 1);

      // idle transition → idle event
      x11.emitIdle(true);
      await waitFor(async () => (await buffer.count()) >= 2);

      // media change → media event
      mpris.emitMedia({
        trackTitle: 'Blinding Lights',
        artist: 'The Weeknd',
        sourceApp: 'org.mpris.MediaPlayer2.spotify',
        durationSeconds: 228,
      });
      await waitFor(async () => (await buffer.count()) >= 3);

      // wait for the sync loop to flush everything
      await waitFor(async () => (await buffer.count()) === 0);

      const eventsCall = calls.find((c) => c.path === '/events');
      expect(eventsCall).toBeDefined();
      const evCall = eventsCall as FakeApiCall;
      expect(evCall.headers?.['x-device-token']).toBe('tok-1');
      const sent = evCall.json as { events: RawEventPayload[] };
      expect(sent.events).toHaveLength(3);
      const ids = sent.events.map((e) => e.eventType).sort();
      expect(ids).toEqual(['focus', 'idle', 'media']);
    } finally {
      await app.stop();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails cleanly when no credentials are stored', async () => {
    const app = new AgentApp({
      config: makeConfig(),
      logger: SILENT_LOGGER,
      store: new InMemoryStore() as never,
      adapters: async () => ({ x11: new FakeX11() as never, mpris: null }),
    });
    await expect(app.start()).rejects.toThrow(/login/);
  });
});
