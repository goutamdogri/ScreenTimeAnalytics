import { afterEach, describe, expect, it } from '@jest/globals';
import { validateConfig } from '../src/config';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadConfig env overrides', () => {
  it('applies STA_* overrides on top of defaults (with no DISPLAY)', async () => {
    process.env.STA_API_BASE_URL = 'https://api.example.com';
    process.env.STA_DEVICE_NAME = 'laptop';
    process.env.STA_POLL_INTERVAL_MS = '500';
    process.env.STA_IDLE_THRESHOLD_MS = '120000';
    process.env.STA_SYNC_INTERVAL_MS = '5000';
    process.env.STA_SYNC_BATCH_SIZE = '10';
    process.env.STA_LOCAL_SERVER_PORT = '0';
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-cfg';
    process.env.XDG_STATE_HOME = '/tmp/xdg-state';

    const { loadConfig } = await import('../src/config');
    const cfg = loadConfig();
    expect(cfg.apiBaseUrl).toBe('https://api.example.com');
    expect(cfg.deviceName).toBe('laptop');
    expect(cfg.pollIntervalMs).toBe(500);
    expect(cfg.idleThresholdMs).toBe(120000);
    expect(cfg.syncIntervalMs).toBe(5000);
    expect(cfg.syncBatchSize).toBe(10);
    // port 0 disables the local server entirely
    expect(cfg.localServerPort).toBeNull();
    expect(cfg.configDir).toBe('/tmp/xdg-cfg/screen-time');
    expect(cfg.spoolDir).toBe('/tmp/xdg-state/screen-time/spool');
  });

  it('falls back to defaults when no env vars are set', async () => {
    delete process.env.STA_API_BASE_URL;
    delete process.env.STA_DEVICE_NAME;
    delete process.env.STA_POLL_INTERVAL_MS;
    delete process.env.STA_IDLE_THRESHOLD_MS;
    delete process.env.STA_SYNC_INTERVAL_MS;
    delete process.env.STA_SYNC_BATCH_SIZE;
    const { loadConfig } = await import('../src/config');
    const cfg = loadConfig();
    expect(cfg.deviceName).toBe('workstation');
    expect(cfg.apiBaseUrl).toBe('http://localhost:3000');
    expect(cfg.localServerPort).toBe(8765);
  });
});

describe('validateConfig', () => {
  it('accepts a healthy config', () => {
    expect(
      validateConfig({
        apiBaseUrl: 'http://localhost:3000',
        deviceName: 'pc',
        platform: 'linux-x11',
        pollIntervalMs: 2000,
        idleThresholdMs: 60000,
        syncIntervalMs: 10000,
        syncBatchSize: 50,
        spoolDir: '/tmp',
        configDir: '/tmp',
        localServerPort: null,
      }),
    ).toBeNull();
  });

  it('rejects bad URLs', () => {
    const err = validateConfig({
      apiBaseUrl: 'localhost:3000',
      deviceName: 'pc',
      platform: 'linux-x11',
      pollIntervalMs: 2000,
      idleThresholdMs: 60000,
      syncIntervalMs: 10000,
      syncBatchSize: 50,
      spoolDir: '/tmp',
      configDir: '/tmp',
      localServerPort: null,
    });
    expect(err).toMatch(/URL/);
  });

  it('rejects zero/negative intervals', () => {
    expect(
      validateConfig({
        apiBaseUrl: 'http://localhost:3000',
        deviceName: 'pc',
        platform: 'linux-x11',
        pollIntervalMs: 0,
        idleThresholdMs: 60000,
        syncIntervalMs: 10000,
        syncBatchSize: 50,
        spoolDir: '/tmp',
        configDir: '/tmp',
        localServerPort: null,
      }),
    ).toMatch(/pollIntervalMs/);
  });
});
