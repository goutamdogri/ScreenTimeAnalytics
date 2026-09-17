import { createAdapters, resolvePlatform } from '../src/adapter-factory';
import type { AgentConfig } from '../src/config';
import { SILENT_LOGGER } from '../src/logger';

function cfg(platform: string): AgentConfig {
  return {
    apiBaseUrl: 'http://api.test',
    deviceName: 'pc',
    platform,
    pollIntervalMs: 1000,
    idleThresholdMs: 60_000,
    syncIntervalMs: 1000,
    syncBatchSize: 50,
    spoolDir: '/tmp',
    configDir: '/tmp',
    localServerPort: null,
  };
}

const originalPlatform = process.platform;

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  delete process.env.XDG_SESSION_TYPE;
});

describe('resolvePlatform', () => {
  it('honors explicit platform overrides', () => {
    expect(resolvePlatform(cfg('linux-wayland'))).toBe('linux-wayland');
    expect(resolvePlatform(cfg('windows'))).toBe('windows');
    expect(resolvePlatform(cfg('linux-x11'))).toBe('linux-x11');
  });

  it('detects Windows on a win32 host', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(resolvePlatform(cfg('auto'))).toBe('windows');
  });

  it('detects Wayland when the session type says so', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.XDG_SESSION_TYPE = 'wayland';
    expect(resolvePlatform(cfg('auto'))).toBe('linux-wayland');
  });

  it('defaults to X11 on a Linux X11 session', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.XDG_SESSION_TYPE;
    expect(resolvePlatform(cfg('auto'))).toBe('linux-x11');
  });

  it('returns unknown for unsupported hosts', () => {
    Object.defineProperty(process, 'platform', { value: 'freebsd' });
    expect(resolvePlatform(cfg('auto'))).toBe('unknown');
  });
});

describe('createAdapters', () => {
  it('assembles windows + smtc on Windows hosts', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const set = await createAdapters(cfg('auto'), SILENT_LOGGER);
    expect(set.platform).toBe('windows');
    expect(set.activeSource).toBe('windows');
    expect(set.mediaSource).toBe('smtc');
    set.active.dispose();
    set.media?.dispose();
  });

  it('falls back to a no-op adapter on unsupported hosts (macOS for now)', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const set = await createAdapters(cfg('auto'), SILENT_LOGGER);
    expect(set.platform).toBe('macos');
    expect(set.activeSource).toBe('none');
    expect(set.active.getActiveWindow()).toBeNull();
    expect(set.media).toBeNull();
    set.active.dispose();
  });
});
