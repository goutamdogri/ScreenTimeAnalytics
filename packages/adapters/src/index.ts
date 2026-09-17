/**
 * PlatformAdapter implementations, used only by the desktop agent (Phases 2/6).
 *
 * The adapter interface below is the contract every OS backend must satisfy
 * (design doc §2.2). `X11Adapter` is the primary Linux path; `WaylandAdapter`
 * (via a GNOME Shell D-Bus probe) and `WindowsAdapter`/`SmtcAdapter` cover
 * platform expansion (design doc §7.6). Changes stay entirely inside this
 * package.
 * An adapter contract test suite must be run against every implementation
 * (design doc §8.3).
 */

export interface ActiveWindowInfo {
  title: string;
  processName: string;
}

export interface NowPlayingInfo {
  trackTitle: string;
  artist: string;
  sourceApp: string;
  durationSeconds: number;
}

export type IdleListener = (idle: boolean) => void;
export type MediaListener = (nowPlaying: NowPlayingInfo | null) => void;

export interface PlatformAdapter {
  /** Begins the adapter's capture loop (polling). Idempotent. */
  start(): void;
  /** Stops the capture loop. Idempotent. */
  stop(): void;
  /** Returns the currently focused window, or `null` if it cannot be determined. */
  getActiveWindow(): ActiveWindowInfo | null;
  /** Registers a callback invoked whenever the user idle/AFK state changes. */
  onIdleChanged(callback: IdleListener): void;
  /** Registers a callback invoked whenever now-playing media metadata changes. */
  onMediaChanged(callback: MediaListener): void;
  /** Frees any OS resources held by the adapter. */
  dispose(): void;
}

export { X11Adapter } from './x11/x11-adapter';
export { WaylandAdapter } from './wayland/wayland-adapter';
export type { WaylandAdapterOptions } from './wayland/wayland-adapter';
export { createWindowProbe } from './wayland/window-probe';
export type { WindowProbe, WindowProbeResult } from './wayland/window-probe';
export { WindowsAdapter } from './windows/windows-adapter';
export type { WindowsAdapterOptions } from './windows/windows-adapter';
export { SmtcAdapter } from './windows/smtc-adapter';
export type { SmtcAdapterOptions } from './windows/smtc-adapter';
export {
  ACTIVE_WINDOW_POWERSHELL,
  IDLE_MILLIS_POWERSHELL,
  NOW_PLAYING_POWERSHELL,
  parseActiveWindowOutput,
  parseIdleMillisOutput,
  parseNowPlayingOutput,
  powershellCommandArgs,
} from './windows/powershell-scripts';
export { NullAdapter } from './null-adapter';
export { MprisAdapter } from './mpris/mpris-adapter';
export { mapMprisMetadata } from './mpris/mpris-metadata';
export { createIdleProbe, createMprisBus } from './dbus/session-probe';
export { parseActiveWindowId, parseWindowMeta } from './x11/x11-parser';
export { runAdapterContractTests } from './testing/contract';
