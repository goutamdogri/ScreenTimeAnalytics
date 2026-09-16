import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import { IdleListener, MediaListener, PlatformAdapter, ActiveWindowInfo } from '../index';
import { ChildProcessCommandRunner, CommandRunner } from '../command-runner';
import { IdleProbe } from '../dbus/session-probe';
import { readComm } from '../process-name';
import { parseActiveWindowId, parseWindowMeta } from './x11-parser';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_IDLE_THRESHOLD_MS = 60_000;

export interface X11AdapterOptions {
  commandRunner?: CommandRunner;
  idleProbe?: IdleProbe | null;
  pollIntervalMs?: number;
  idleThresholdMs?: number;
  logger?: AdapterLogger;
  /** Injectable process-name reader for /proc/<pid>/comm (tests only). */
  readComm?: (pid: string) => Promise<string | null>;
}

/**
 * X11 platform adapter: tracks the focused window via `xprop` and the AFK
 * state via the D-Bus idle probe (`org.freedesktop.ScreenSaver` / Mutter).
 *
 * Every OS call is failure-isolated — a missing `xprop` binary, an unusable
 * display, or a dead session bus degrades the affected signal to `null`/
 * `false` instead of throwing (design doc §8.4 "graceful adapter degradation").
 *
 * `getActiveWindow()` returns the latest cached snapshot synchronously so the
 * agent's event loop never blocks on a subprocess; the internal poll loop
 * keeps the cache warm.
 */
export class X11Adapter implements PlatformAdapter {
  private readonly runner: CommandRunner;
  private readonly idleProbe: IdleProbe | null;
  private readonly pollIntervalMs: number;
  private readonly idleThresholdMs: number;
  private readonly logger: AdapterLogger;
  private readonly readComm: (pid: string) => Promise<string | null>;
  private readonly idleListeners: IdleListener[] = [];
  private readonly mediaListeners: MediaListener[] = [];
  private windowCache: ActiveWindowInfo | null = null;
  private idleState = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private displayPresent: boolean;

  constructor(opts: X11AdapterOptions = {}) {
    this.runner = opts.commandRunner ?? new ChildProcessCommandRunner();
    this.idleProbe = opts.idleProbe ?? null;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.idleThresholdMs = opts.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;
    this.logger = opts.logger ?? SILENT_LOGGER;
    this.readComm = opts.readComm ?? readComm;
    this.displayPresent = Boolean(process.env.DISPLAY);
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
    /* media is handled by MprisAdapter */
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.idleListeners.length = 0;
    this.mediaListeners.length = 0;
    this.idleProbe?.dispose();
  }

  private async poll(): Promise<void> {
    await Promise.allSettled([this.refreshWindow(), this.refreshIdle()]);
  }

  private async refreshWindow(): Promise<void> {
    if (!this.displayPresent) {
      this.windowCache = null;
      return;
    }

    try {
      const root = await this.runner.run('xprop', ['-root', '_NET_ACTIVE_WINDOW'], 2_000);
      const windowId = parseActiveWindowId(root.stdout);

      let title: string | null = null;
      let processName: string | null = null;

      if (windowId !== null) {
        const meta = await this.runner.run(
          'xprop',
          ['-id', windowId, '_NET_WM_NAME', 'WM_NAME', '_NET_WM_PID'],
          2_000,
        );
        const parsed = parseWindowMeta(meta.stdout);
        title = parsed.title;
        processName = parsed.pid !== null ? await this.readComm(parsed.pid) : null;
      }

      if (title === null && processName === null) {
        this.windowCache = null;
        return;
      }
      this.windowCache = {
        title: title ?? processName ?? 'unknown',
        processName: processName ?? 'unknown',
      };
    } catch (error) {
      this.logger.debug(`Active window refresh failed: ${errorMessage(error)}`);
      this.windowCache = null;
    }
  }

  private async refreshIdle(): Promise<void> {
    if (!this.idleProbe) return;

    try {
      const idleMs = await this.idleProbe.getIdleTimeMs();
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
