import { ActiveWindowInfo, IdleListener, MediaListener, PlatformAdapter } from './index';

/**
 * No-op platform adapter used on unsupported platforms (macOS for now,
 * unknown). Reports no window, never idle, no media — the agent keeps
 * running (design doc §8.4) instead of failing to start.
 */
export class NullAdapter implements PlatformAdapter {
  start(): void {}

  stop(): void {}

  getActiveWindow(): ActiveWindowInfo | null {
    return null;
  }

  onIdleChanged(_cb: IdleListener): void {}

  onMediaChanged(_cb: MediaListener): void {}

  dispose(): void {}
}
