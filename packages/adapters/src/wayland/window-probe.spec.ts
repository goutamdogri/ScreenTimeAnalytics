import { SessionBus } from '../dbus/session-bus';
import {
  WINDOW_PROBE_DESTINATION,
  WINDOW_PROBE_PATH,
  WINDOW_PROBE_INTERFACE,
  createWindowProbeFromBus,
  windowProbeMessage,
} from './window-probe';

/** Captures the messages pushed through the fake bus so tests can assert them. */
class CapturedBus implements SessionBus {
  readonly calls: unknown[] = [];
  private readonly body: unknown[];
  private readonly error: boolean;

  constructor(body: unknown[], error = false) {
    this.body = body;
    this.error = error;
  }

  async call(message: unknown): Promise<{ body: unknown[] }> {
    this.calls.push(message);
    if (this.error) throw new Error('bus unavailable');
    return { body: this.body };
  }

  disconnect(): void {}
}

function fakeMessage() {
  return class FakeMessage {
    constructor(readonly opts: Record<string, unknown>) {}
  };
}

describe('window probe over the session bus', () => {
  it('returns title + appId when the extension reports a focused window', async () => {
    const bus = new CapturedBus(['Terminal', 'org.gnome.Ptyxis.Terminal']);
    const probe = createWindowProbeFromBus(bus, fakeMessage() as never);

    await expect(probe.getActiveWindow()).resolves.toEqual({
      title: 'Terminal',
      appId: 'org.gnome.Ptyxis.Terminal',
    });
  });

  it('returns null when the extension reports no focused window', async () => {
    const bus = new CapturedBus(['', '']);
    const probe = createWindowProbeFromBus(bus, fakeMessage() as never);

    await expect(probe.getActiveWindow()).resolves.toBeNull();
  });

  it('returns null and never throws when the bus call fails', async () => {
    const bus = new CapturedBus([], true);
    const probe = createWindowProbeFromBus(bus, fakeMessage() as never);

    await expect(probe.getActiveWindow()).resolves.toBeNull();
  });

  it('targets the well-known probe coordinates', async () => {
    const bus = new CapturedBus(['', '']);
    const probe = createWindowProbeFromBus(bus, fakeMessage() as never);
    await probe.getActiveWindow();

    expect(bus.calls).toHaveLength(1);
    const opts = (bus.calls[0] as unknown as { opts: Record<string, unknown> }).opts;
    expect(opts.destination).toBe(WINDOW_PROBE_DESTINATION);
    expect(opts.path).toBe(WINDOW_PROBE_PATH);
    expect(opts.interface).toBe(WINDOW_PROBE_INTERFACE);
    expect(opts.member).toBe('GetActiveWindow');
    expect(opts.signature).toBe('');
  });

  it('buildMessage produces a well-formed Message', () => {
    const message = windowProbeMessage(fakeMessage() as never);
    const opts = (message as unknown as { opts: Record<string, unknown> }).opts;
    expect(opts).toMatchObject({
      destination: WINDOW_PROBE_DESTINATION,
      path: WINDOW_PROBE_PATH,
      interface: WINDOW_PROBE_INTERFACE,
      member: 'GetActiveWindow',
    });
  });

  it('dispose() disconnects the underlying bus', () => {
    const bus = new CapturedBus([]);
    const probe = createWindowProbeFromBus(bus, fakeMessage() as never);
    expect(() => probe.dispose()).not.toThrow();
  });
});
