import {
  MprisAdapter,
  NullAdapter,
  SmtcAdapter,
  WaylandAdapter,
  WindowsAdapter,
  X11Adapter,
  createIdleProbe,
  createMprisBus,
  createWindowProbe,
  type PlatformAdapter,
} from '@screen-time/adapters';

import type { AgentConfig } from './config';
import type { AgentLogger } from './logger';

/** Platform identities understood by the backend device registry. */
export type PlatformId = 'linux-x11' | 'linux-wayland' | 'windows' | 'macos' | 'unknown';

/** Where a focus/idle event originated (the backend's `source` field). */
export type AdapterSource = 'x11' | 'wayland' | 'windows' | 'none';
/** Where a media event originated (`null` = media capture unavailable). */
export type MediaSource = 'mpris' | 'smtc' | null;

/**
 * The runtime consumes a single "active window + idle" adapter and a single
 * "media" adapter (design doc §2.2). Both are plain `PlatformAdapter`s.
 */
export interface AdapterSet {
  active: PlatformAdapter;
  activeSource: AdapterSource;
  media: PlatformAdapter | null;
  mediaSource: MediaSource;
  /** The concrete platform identity to report at device registration. */
  platform: PlatformId;
}

const KNOWN_PLATFORMS: readonly PlatformId[] = [
  'linux-x11',
  'linux-wayland',
  'windows',
  'macos',
  'unknown',
];

/**
 * Resolves the effective platform. `config.platform` is an explicit override
 * when it names a known platform (`STA_PLATFORM`); otherwise the host is
 * detected from `process.platform` + `XDG_SESSION_TYPE`.
 */
export function resolvePlatform(config: AgentConfig): PlatformId {
  const explicit = config.platform.trim();
  if ((KNOWN_PLATFORMS as readonly string[]).includes(explicit)) {
    return explicit as PlatformId;
  }
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'linux') {
    return process.env.XDG_SESSION_TYPE === 'wayland' ? 'linux-wayland' : 'linux-x11';
  }
  return 'unknown';
}

/**
 * Builds the adapter set for the current host. Every path degrades
 * gracefully: missing D-Bus services/buses drop the affected signal, and
 * unsupported platforms (`macos`, `unknown`) run a no-op adapter so the
 * agent still starts (design doc §8.4).
 */
export async function createAdapters(
  config: AgentConfig,
  logger: AgentLogger,
): Promise<AdapterSet> {
  const platform = resolvePlatform(config);
  switch (platform) {
    case 'linux-x11': {
      const idleProbe = await createIdleProbe(logger);
      const active = new X11Adapter({
        idleProbe,
        pollIntervalMs: config.pollIntervalMs,
        idleThresholdMs: config.idleThresholdMs,
        logger,
      });
      const media = await createMprisMedia(logger);
      return { active, activeSource: 'x11', media, mediaSource: media ? 'mpris' : null, platform };
    }
    case 'linux-wayland': {
      const windowProbe = await createWindowProbe(logger);
      const idleProbe = await createIdleProbe(logger);
      const active = new WaylandAdapter({
        windowProbe,
        idleProbe,
        pollIntervalMs: config.pollIntervalMs,
        idleThresholdMs: config.idleThresholdMs,
        logger,
      });
      const media = await createMprisMedia(logger);
      return {
        active,
        activeSource: 'wayland',
        media,
        mediaSource: media ? 'mpris' : null,
        platform,
      };
    }
    case 'windows': {
      const active = new WindowsAdapter({
        pollIntervalMs: config.pollIntervalMs,
        idleThresholdMs: config.idleThresholdMs,
        logger,
      });
      const media = new SmtcAdapter({ pollIntervalMs: config.pollIntervalMs, logger });
      return { active, activeSource: 'windows', media, mediaSource: 'smtc', platform };
    }
    default: {
      return {
        active: new NullAdapter(),
        activeSource: 'none',
        media: null,
        mediaSource: null,
        platform,
      };
    }
  }
}

async function createMprisMedia(logger: AgentLogger): Promise<MprisAdapter | null> {
  const bus = await createMprisBus(logger);
  return bus === null ? null : new MprisAdapter({ bus, logger });
}
