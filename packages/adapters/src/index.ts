/**
 * PlatformAdapter implementations, used only by the desktop agent (Phase 2).
 *
 * The adapter interface below is the contract every OS backend must satisfy
 * (design doc §2.2). `X11Adapter` is built first; Wayland and Windows adapters
 * are added later without touching anything outside this package.
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
export { MprisAdapter } from './mpris/mpris-adapter';
export { mapMprisMetadata } from './mpris/mpris-metadata';
export { createIdleProbe, createMprisBus } from './dbus/session-probe';
export { parseActiveWindowId, parseWindowMeta } from './x11/x11-parser';
export { runAdapterContractTests } from './testing/contract';
