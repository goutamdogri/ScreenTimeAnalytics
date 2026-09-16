import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Agent runtime configuration.
 *
 * Resolution order (lowest to highest precedence):
 *   1. built-in defaults
 *   2. settings file `~/.config/screen-time/agent.json` (or STA_CONFIG_PATH)
 *   3. environment variables `STA_*`
 */
export interface AgentConfig {
  /** The platform identity reported when registering a device. */
  apiBaseUrl: string;
  deviceName: string;
  platform: string;
  /** How often the X11 window capture loop polls (ms). */
  pollIntervalMs: number;
  /** How long the user must be idle before an idle event is buffered (ms). */
  idleThresholdMs: number;
  /** How often the sync loop pushes buffered events to the backend (ms). */
  syncIntervalMs: number;
  /** Max number of events sent per batch. */
  syncBatchSize: number;
  /** Directory that holds the buffered-events spool (JSONL). */
  spoolDir: string;
  /** Directory that holds the agent settings file. */
  configDir: string;
  /**
   * Port for the optional localhost capture surface (POST /event, /health).
   * `null` disables the local server entirely.
   */
  localServerPort: number | null;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function strEnv(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? undefined : raw;
}

export function resolvePaths(): { configDir: string; spoolDir: string } {
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const xdgState = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  const configDir = strEnv('STA_CONFIG_DIR') ?? join(xdgConfig, 'screen-time');
  const spoolDir = strEnv('STA_SPOOL_DIR') ?? join(xdgState, 'screen-time', 'spool');
  return { configDir, spoolDir };
}

export function configStorePath(configDir: string): string {
  return resolve(process.env.STA_CONFIG_PATH ?? join(configDir, 'agent.json'));
}

export const DEFAULT_CONFIG: AgentConfig = {
  apiBaseUrl: 'http://localhost:3000',
  deviceName: 'workstation',
  platform: 'linux-x11',
  pollIntervalMs: 2000,
  idleThresholdMs: 60_000,
  syncIntervalMs: 10_000,
  syncBatchSize: 50,
  spoolDir: '',
  configDir: '',
  localServerPort: 8765,
};

export function loadConfig(): AgentConfig {
  const { configDir, spoolDir } = resolvePaths();
  const cfg: AgentConfig = { ...DEFAULT_CONFIG, configDir, spoolDir };

  const fromEnv: Partial<AgentConfig> = {
    apiBaseUrl: strEnv('STA_API_BASE_URL') ?? cfg.apiBaseUrl,
    deviceName: strEnv('STA_DEVICE_NAME') ?? cfg.deviceName,
    platform: strEnv('STA_PLATFORM') ?? cfg.platform,
    pollIntervalMs: intEnv('STA_POLL_INTERVAL_MS', cfg.pollIntervalMs),
    idleThresholdMs: intEnv('STA_IDLE_THRESHOLD_MS', cfg.idleThresholdMs),
    syncIntervalMs: intEnv('STA_SYNC_INTERVAL_MS', cfg.syncIntervalMs),
    syncBatchSize: intEnv('STA_SYNC_BATCH_SIZE', cfg.syncBatchSize),
    spoolDir: strEnv('STA_SPOOL_DIR') ?? cfg.spoolDir,
    localServerPort: cfg.localServerPort,
  };

  if (fromEnv.apiBaseUrl !== undefined) cfg.apiBaseUrl = fromEnv.apiBaseUrl;
  if (fromEnv.deviceName !== undefined) cfg.deviceName = fromEnv.deviceName;
  if (fromEnv.platform !== undefined) cfg.platform = fromEnv.platform;
  if (fromEnv.pollIntervalMs !== undefined) cfg.pollIntervalMs = fromEnv.pollIntervalMs;
  if (fromEnv.idleThresholdMs !== undefined) cfg.idleThresholdMs = fromEnv.idleThresholdMs;
  if (fromEnv.syncIntervalMs !== undefined) cfg.syncIntervalMs = fromEnv.syncIntervalMs;
  if (fromEnv.syncBatchSize !== undefined) cfg.syncBatchSize = fromEnv.syncBatchSize;
  if (fromEnv.spoolDir !== undefined) cfg.spoolDir = fromEnv.spoolDir;

  const portEnv = intEnv('STA_LOCAL_SERVER_PORT', -1);
  if (portEnv === 0)
    cfg.localServerPort = null; // 0 disables the local server
  else if (portEnv > 0) cfg.localServerPort = portEnv;
  // -1 (unset) keeps the default

  return cfg;
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!/^https?:\/\//.test(cfg.apiBaseUrl)) return 'apiBaseUrl must be an http(s) URL';
  if (!cfg.deviceName.trim()) return 'deviceName must not be empty';
  if (cfg.pollIntervalMs <= 0) return 'pollIntervalMs must be > 0';
  if (cfg.syncIntervalMs <= 0) return 'syncIntervalMs must be > 0';
  if (cfg.syncBatchSize <= 0) return 'syncBatchSize must be > 0';
  if (cfg.idleThresholdMs <= 0) return 'idleThresholdMs must be > 0';
  return null;
}
