import { ActiveWindowInfo, IdleListener, MediaListener, PlatformAdapter } from '../index';
import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import { CommandRunner, ChildProcessCommandRunner } from '../command-runner';
import {
  ACTIVE_WINDOW_POWERSHELL,
  IDLE_MILLIS_POWERSHELL,
  POWERSHELL_EXE,
  parseActiveWindowOutput,
  parseIdleMillisOutput,
  powershellCommandArgs,
} from './powershell-scripts';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_IDLE_THRESHOLD_MS = 60_000;
const PROBE_TIMEOUT_MS = 3_000;

export interface WindowsAdapterOptions {
  commandRunner?: CommandRunner;
  pollIntervalMs?: number;
  idleThresholdMs?: number;
  logger?: AdapterLogger;
}

/**
 * Windows platform adapter: foreground window (title + process name) and
 * AFK state via `GetLastInputInfo`, both through `powershell.exe`.
 *
 * Every probe is failure-isolated — a broken pipe, a parsing hiccup, or a
 * non-Windows host degrades the affected signal to `null`/`false` rather than
 * throwing (design doc §8.4). Media stays on `SmtcAdapter`.
 */
export class WindowsAdapter implements PlatformAdapter {
  private readonly runner: CommandRunner;
  private readonly pollIntervalMs: number;
  private readonly idleThresholdMs: number;
  private readonly logger: AdapterLogger;
  private readonly idleListeners: IdleListener[] = [];
  private readonly mediaListeners: MediaListener[] = [];
  private windowCache: ActiveWindowInfo | null = null;
  private idleState = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(opts: WindowsAdapterOptions = {}) {
    this.runner = opts.commandRunner ?? new ChildProcessCommandRunner();
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.idleThresholdMs = opts.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;
    this.logger = opts.logger ?? SILENT_LOGGER;
  }

  /** Begins the polling loop. */
  start(): void {
    if (this.pollTimer !== null || this.disposed) return;
    this.pollTimer = setInterval(() => void this.poll(), this.pollIntervalMs);
    void this.poll();
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getActiveWindow(): ActiveWindowInfo | null {
    return this.windowCache;
  }

  /** Whether the idle probe currently reports the user as AFK. */
  isIdle(): boolean {
    return this.idleState;
  }

  onIdleChanged(cb: IdleListener): void {
    this.idleListeners.push(cb);
  }

  onMediaChanged(_cb: MediaListener): void {
    /* media is handled by SmtcAdapter */
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.idleListeners.length = 0;
    this.mediaListeners.length = 0;
  }

  private async poll(): Promise<void> {
    await Promise.allSettled([this.refreshWindow(), this.refreshIdle()]);
  }

  private async refreshWindow(): Promise<void> {
    try {
      const result = await this.runner.run(
        POWERSHELL_EXE,
        powershellCommandArgs(ACTIVE_WINDOW_POWERSHELL),
        PROBE_TIMEOUT_MS,
      );
      this.windowCache = parseActiveWindowOutput(result.stdout);
    } catch (error) {
      this.logger.debug(`Active window refresh failed: ${errorMessage(error)}`);
      this.windowCache = null;
    }
  }

  private async refreshIdle(): Promise<void> {
    try {
      const result = await this.runner.run(
        POWERSHELL_EXE,
        powershellCommandArgs(IDLE_MILLIS_POWERSHELL),
        PROBE_TIMEOUT_MS,
      );
      const idleMs = parseIdleMillisOutput(result.stdout);
      if (idleMs < 0) return;
      const nowIdle = idleMs >= this.idleThresholdMs;
      if (nowIdle === this.idleState) return;

      this.idleState = nowIdle;
      for (const cb of this.idleListeners) {
        try {
          cb(nowIdle);
        } catch {
          /* listener errors must not crash the agent */
        }
      }
    } catch (error) {
      this.logger.debug(`Idle refresh failed: ${errorMessage(error)}`);
    }
  }
}
