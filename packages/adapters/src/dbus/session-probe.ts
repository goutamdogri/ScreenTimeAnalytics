import type { MessageBus } from 'dbus-next';
import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';

/**
 * Structural view of the D-Bus session bus that the idle probe and MPRIS
 * adapter depend on. Production instances wrap `dbus-next`'s `MessageBus`;
 * tests inject fakes.
 */
export interface SessionBus {
  call(message: unknown): Promise<{ body: unknown[] }>;
  disconnect(): void;
}

export interface IdleProbe {
  getIdleTimeMs(): Promise<number>;
  dispose(): void;
}

export interface MprisBus {
  /** Returns the well-known bus names of current MPRIS players. */
  listPlayerNames(): Promise<string[]>;
  /** Returns raw Metadata properties, or an empty object on failure. */
  getPlayerMetadata(playerBusName: string): Promise<Record<string, unknown>>;
  dispose(): void;
}

function toSessionBus(bus: MessageBus): SessionBus {
  return {
    async call(message) {
      const reply = await bus.call(message as Parameters<MessageBus['call']>[0]);
      return reply ? { body: reply.body ?? [] } : { body: [] };
    },
    disconnect: () => bus.disconnect(),
  };
}

/**
 * Loads the AFK idle probe for this D-Bus session, preferring the
 * freedesktop ScreenSaver interface and falling back to the GNOME Mutter
 * IdleMonitor. Returns null when no idle source is available (safe
 * degradation).
 */
export async function createIdleProbe(logger?: AdapterLogger): Promise<IdleProbe | null> {
  const log = logger ?? SILENT_LOGGER;
  try {
    const dbus = await import('dbus-next');
    const messageBus = dbus.sessionBus();
    if (!messageBus) return null;
    const bus = toSessionBus(messageBus);

    const screensaver = await tryScreensaver(bus);
    if (screensaver) return screensaver;

    const mutter = await tryMutter(bus);
    if (mutter) return mutter;

    messageBus.disconnect();
    return null;
  } catch (error) {
    log.warn(`D-Bus session bus unavailable; idle detection disabled: ${errorMessage(error)}`);
    return null;
  }
}

/** Creates an MPRIS bus reader over the session bus, or null if unavailable. */
export async function createMprisBus(logger?: AdapterLogger): Promise<MprisBus | null> {
  const log = logger ?? SILENT_LOGGER;
  try {
    const dbus = await import('dbus-next');
    const messageBus = dbus.sessionBus();
    if (!messageBus) return null;
    const bus = toSessionBus(messageBus);

    return {
      async listPlayerNames() {
        const { Message } = dbus;
        const reply = await bus.call(
          new Message({
            destination: 'org.freedesktop.DBus',
            path: '/org/freedesktop/DBus',
            interface: 'org.freedesktop.DBus',
            member: 'ListNames',
            signature: '',
            body: [],
          }),
        );
        const names = (reply.body[0] as string[] | undefined) ?? [];
        return names.filter((name) => name.startsWith('org.mpris.MediaPlayer2.'));
      },

      async getPlayerMetadata(playerBusName) {
        const { Message } = dbus;
        const reply = await bus.call(
          new Message({
            destination: playerBusName,
            path: '/org/mpris/MediaPlayer2',
            interface: 'org.freedesktop.DBus.Properties',
            member: 'Get',
            signature: 'ss',
            body: ['org.mpris.MediaPlayer2.Player', 'Metadata'],
          }),
        );
        const variant = (reply.body[0] as { value?: unknown } | undefined) ?? {};
        return (variant.value ?? {}) as Record<string, unknown>;
      },

      dispose: () => messageBus.disconnect(),
    };
  } catch (error) {
    log.warn(`MPRIS unavailable; media events disabled: ${errorMessage(error)}`);
    return null;
  }
}

function screensaverIdleMessage(Message: (typeof import('dbus-next'))['Message']) {
  return new Message({
    destination: 'org.freedesktop.ScreenSaver',
    path: '/org/freedesktop/ScreenSaver',
    interface: 'org.freedesktop.ScreenSaver',
    member: 'GetActiveTime',
    signature: '',
    body: [],
  });
}

async function tryScreensaver(bus: SessionBus): Promise<IdleProbe | null> {
  const { Message } = await import('dbus-next');
  try {
    const reply = await bus.call(screensaverIdleMessage(Message));
    const seconds = Number((reply.body[0] as number | bigint | undefined) ?? NaN);
    if (!Number.isFinite(seconds)) return null;

    return {
      async getIdleTimeMs() {
        const r = await bus.call(screensaverIdleMessage(Message));
        const s = Number((r.body[0] as number | bigint | undefined) ?? 0);
        return s * 1000;
      },
      dispose: () => bus.disconnect(),
    };
  } catch {
    return null;
  }
}

function mutterIdleMessage(Message: (typeof import('dbus-next'))['Message']) {
  return new Message({
    destination: 'org.gnome.Mutter.IdleMonitor',
    path: '/org/gnome/Mutter/IdleMonitor/Core',
    interface: 'org.gnome.Mutter.IdleMonitor',
    member: 'GetIdletime',
    signature: '',
    body: [],
  });
}

async function tryMutter(bus: SessionBus): Promise<IdleProbe | null> {
  const { Message } = await import('dbus-next');
  try {
    const reply = await bus.call(mutterIdleMessage(Message));
    const ms = Number((reply.body[0] as number | bigint | undefined) ?? NaN);
    if (!Number.isFinite(ms)) return null;

    return {
      async getIdleTimeMs() {
        const r = await bus.call(mutterIdleMessage(Message));
        return Number((r.body[0] as number | bigint | undefined) ?? 0);
      },
      dispose: () => bus.disconnect(),
    };
  } catch {
    return null;
  }
}
