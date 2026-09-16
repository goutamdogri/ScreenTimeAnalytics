import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import {
  NowPlayingInfo,
  ActiveWindowInfo,
  IdleListener,
  MediaListener,
  PlatformAdapter,
} from '../index';
import type { MprisBus } from '../dbus/session-probe';
import { mapMprisMetadata } from './mpris-metadata';

export interface MprisAdapterOptions {
  bus: MprisBus;
  pollIntervalMs?: number;
  logger?: AdapterLogger;
}

const DEFAULT_POLL_INTERVAL_MS = 3_000;

/**
 * MediaPlayer2 (MPRIS) adapter that reports now-playing metadata over D-Bus.
 *
 * Implements `PlatformAdapter` (media part only): `getActiveWindow()` is
 * always `null` and `onIdleChanged` is a no-op — the X11 adapter covers those.
 */
export class MprisAdapter implements PlatformAdapter {
  private readonly bus: MprisBus;
  private readonly pollIntervalMs: number;
  private readonly logger: AdapterLogger;
  private readonly mediaListeners: MediaListener[] = [];
  private readonly idleListeners: IdleListener[] = [];
  private current: NowPlayingInfo | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: MprisAdapterOptions) {
    this.bus = opts.bus;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.logger = opts.logger ?? SILENT_LOGGER;
  }

  start(): void {
    if (this.pollTimer !== null) return;
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
    return null;
  }

  onIdleChanged(cb: IdleListener): void {
    this.idleListeners.push(cb);
  }

  onMediaChanged(cb: MediaListener): void {
    this.mediaListeners.push(cb);
  }

  dispose(): void {
    this.stop();
    this.bus.dispose();
    this.mediaListeners.length = 0;
    this.idleListeners.length = 0;
  }

  /** Returns the latest observed now-playing metadata without extra D-Bus calls. */
  getNowPlaying(): NowPlayingInfo | null {
    return this.current;
  }

  private async poll(): Promise<void> {
    let next: NowPlayingInfo | null = null;
    try {
      const players = await this.bus.listPlayerNames();
      const player = players[0];
      if (player) {
        const raw = await this.bus.getPlayerMetadata(player);
        next = mapMprisMetadata(raw, player);
      }
    } catch (error) {
      this.logger.debug(`MPRIS poll failed: ${errorMessage(error)}`);
      next = null;
    }

    const changed =
      (this.current === null && next !== null) ||
      (this.current !== null && next === null) ||
      (this.current !== null &&
        next !== null &&
        (this.current.trackTitle !== next.trackTitle ||
          this.current.artist !== next.artist ||
          this.current.sourceApp !== next.sourceApp ||
          this.current.durationSeconds !== next.durationSeconds));
    if (!changed) return;

    this.current = next;
    for (const cb of this.mediaListeners) {
      try {
        cb(next);
      } catch {
        /* listener errors must not crash the agent */
      }
    }
  }
}
