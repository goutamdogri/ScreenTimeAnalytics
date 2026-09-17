import { AdapterLogger, SILENT_LOGGER, errorMessage } from '../logger';
import { SessionBus, toSessionBus } from '../dbus/session-bus';

/** Well-known D-Bus coordinates of the GNOME Shell window probe extension. */
export const WINDOW_PROBE_DESTINATION = 'org.screentime.WindowProbe';
export const WINDOW_PROBE_PATH = '/org/screentime/WindowProbe';
export const WINDOW_PROBE_INTERFACE = 'org.screentime.WindowProbe';

export interface WindowProbeResult {
  title: string;
  appId: string;
}

export interface WindowProbe {
  /**
   * Returns the focused window reported by the GNOME Shell extension, or
   * `null` when the extension is unreachable or no window is focused
   * (safe degradation).
   */
  getActiveWindow(): Promise<WindowProbeResult | null>;
  dispose(): void;
}

type Message = (typeof import('dbus-next'))['Message'];

/** Builds the `GetActiveWindow` method call on the probe interface. */
export function windowProbeMessage(Message: Message) {
  return new Message({
    destination: WINDOW_PROBE_DESTINATION,
    path: WINDOW_PROBE_PATH,
    interface: WINDOW_PROBE_INTERFACE,
    member: 'GetActiveWindow',
    signature: '',
    body: [],
  });
}

/**
 * Wraps an injected session bus as a `WindowProbe`. Kept separate from
 * `createWindowProbe` so unit tests can drive a fake bus; the extension
 * replies with `(s s)` title/appId (both empty = no focused window).
 */
export function createWindowProbeFromBus(bus: SessionBus, Message: Message): WindowProbe {
  return {
    async getActiveWindow() {
      try {
        const reply = await bus.call(windowProbeMessage(Message));
        const title = typeof reply.body[0] === 'string' ? reply.body[0] : '';
        const appId = typeof reply.body[1] === 'string' ? reply.body[1] : '';
        if (title === '' && appId === '') return null;
        return { title, appId };
      } catch {
        return null;
      }
    },
    dispose: () => bus.disconnect(),
  };
}

/**
 * Loads the Wayland window probe over the session bus, or returns `null` when
 * the bus is unavailable (non-GNOME compositor or missing extension) so the
 * agent degrades to no window tracking rather than failing.
 */
export async function createWindowProbe(logger?: AdapterLogger): Promise<WindowProbe | null> {
  const log = logger ?? SILENT_LOGGER;
  try {
    const dbus = await import('dbus-next');
    const messageBus = dbus.sessionBus();
    if (!messageBus) return null;
    return createWindowProbeFromBus(toSessionBus(messageBus), dbus.Message);
  } catch (error) {
    log.warn(
      `Wayland window probe unavailable; active-window tracking disabled: ${errorMessage(error)}`,
    );
    return null;
  }
}
