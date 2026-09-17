import {
  NowPlayingInfo,
  ActiveWindowInfo,
  IdleListener,
  MediaListener,
  PlatformAdapter,
} from '../index';
import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import { CommandRunner, ChildProcessCommandRunner } from '../command-runner';
import {
  NOW_PLAYING_POWERSHELL,
  POWERSHELL_EXE,
  parseNowPlayingOutput,
  powershellCommandArgs,
} from './powershell-scripts';

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const PROBE_TIMEOUT_MS = 3_000;

export interface SmtcAdapterOptions {
  commandRunner?: CommandRunner;
  pollIntervalMs?: number;
  logger?: AdapterLogger;
}

/**
 * SMTC (Windows) media adapter: reports now-playing metadata from the global
 * media session via PowerShell. Platform-analogue of `MprisAdapter`.
 *
 * Implements `PlatformAdapter` (media part only): `getActiveWindow()` is
 * always `null` and `onIdleChanged` is a no-op — the Windows adapter covers
 * those (design doc §2.2).
 */
export class SmtcAdapter implements PlatformAdapter {
  private readonly runner: CommandRunner;
  private readonly pollIntervalMs: number;
  private readonly logger: AdapterLogger;
  private readonly mediaListeners: MediaListener[] = [];
  private readonly idleListeners: IdleListener[] = [];
  private current: NowPlayingInfo | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: SmtcAdapterOptions = {}) {
    this.runner = opts.commandRunner ?? new ChildProcessCommandRunner();
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
    this.mediaListeners.length = 0;
    this.idleListeners.length = 0;
  }

  /** Returns the latest observed now-playing metadata without extra probes. */
  getNowPlaying(): NowPlayingInfo | null {
    return this.current;
  }

  private async poll(): Promise<void> {
    let next: NowPlayingInfo | null = null;
    try {
      const result = await this.runner.run(
        POWERSHELL_EXE,
        powershellCommandArgs(NOW_PLAYING_POWERSHELL),
        PROBE_TIMEOUT_MS,
      );
      next = parseNowPlayingOutput(result.stdout);
    } catch (error) {
      this.logger.debug(`SMTC poll failed: ${errorMessage(error)}`);
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
