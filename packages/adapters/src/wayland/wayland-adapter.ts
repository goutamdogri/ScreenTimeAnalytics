import { ActiveWindowInfo, IdleListener, MediaListener, PlatformAdapter } from '../index';
import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import { IdleProbe } from '../dbus/session-probe';
import { WindowProbe, WindowProbeResult } from './window-probe';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_IDLE_THRESHOLD_MS = 60_000;

export interface WaylandAdapterOptions {
  windowProbe?: WindowProbe | null;
  idleProbe?: IdleProbe | null;
  pollIntervalMs?: number;
  idleThresholdMs?: number;
  logger?: AdapterLogger;
}

/**
 * Wayland (GNOME) platform adapter: tracks the focused window through a
 * GNOME Shell extension exposed over D-Bus (Wayland blocks cross-app window
 * queries by design) and AFK state via the same idle probe the X11 adapter
 * uses (Mutter IdleMonitor on the session bus).
 *
 * Mirrors the X11 adapter's failure isolation: a missing extension, bus, or
 * idle source degrades the affected signal to `null`/`false` (design doc
 * §8.4) and media stays on the bus-agnostic `MprisAdapter`.
 */
export class WaylandAdapter implements PlatformAdapter {
  private readonly windowProbe: WindowProbe | null;
  private readonly idleProbe: IdleProbe | null;
  private readonly pollIntervalMs: number;
  private readonly idleThresholdMs: number;
  private readonly logger: AdapterLogger;
  private readonly idleListeners: IdleListener[] = [];
  private readonly mediaListeners: MediaListener[] = [];
  private windowCache: ActiveWindowInfo | null = null;
  private idleState = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(opts: WaylandAdapterOptions = {}) {
    this.windowProbe = opts.windowProbe ?? null;
    this.idleProbe = opts.idleProbe ?? null;
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
    /* media is handled by MprisAdapter */
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.idleListeners.length = 0;
    this.mediaListeners.length = 0;
    this.windowProbe?.dispose();
    this.idleProbe?.dispose();
  }

  private async poll(): Promise<void> {
    await Promise.allSettled([this.refreshWindow(), this.refreshIdle()]);
  }

  private async refreshWindow(): Promise<void> {
    if (!this.windowProbe) {
      this.windowCache = null;
      return;
    }
    try {
      const result = await this.windowProbe.getActiveWindow();
      this.windowCache = toActiveWindow(result);
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

function toActiveWindow(result: WindowProbeResult | null): ActiveWindowInfo | null {
  if (result === null) return null;
  if (result.title === '' && result.appId === '') return null;
  return {
    title: result.title !== '' ? result.title : result.appId,
    processName: result.appId !== '' ? result.appId : result.title,
  };
}
