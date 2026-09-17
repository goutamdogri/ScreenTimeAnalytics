import { WindowProbe, WindowProbeResult } from './window-probe';
import { WaylandAdapter } from './wayland-adapter';
import { IdleProbe } from '../dbus/session-probe';
import { runAdapterContractTests } from '../testing/contract';

function fakeWindowProbe(values: Array<WindowProbeResult | null>): WindowProbe {
  let i = 0;
  return {
    getActiveWindow: jest.fn(async () => values[i++] ?? null),
    dispose: jest.fn(),
  };
}

function fakeIdleProbe(values: number[]): IdleProbe {
  let i = 0;
  return {
    getIdleTimeMs: jest.fn(async () => values[i++] ?? 0),
    dispose: jest.fn(),
  };
}

describe('WaylandAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null before any poll', () => {
    const adapter = new WaylandAdapter({
      windowProbe: fakeWindowProbe([]),
      idleProbe: fakeIdleProbe([]),
    });
    expect(adapter.getActiveWindow()).toBeNull();
    expect(adapter.isIdle()).toBe(false);
    adapter.dispose();
  });

  it('caches the focused window (title + appId) after a poll', async () => {
    const adapter = new WaylandAdapter({
      windowProbe: fakeWindowProbe([{ title: 'Terminal', appId: 'org.gnome.Ptyxis.Terminal' }]),
      idleProbe: fakeIdleProbe([0]),
      pollIntervalMs: 1000,
    });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toEqual({
      title: 'Terminal',
      processName: 'org.gnome.Ptyxis.Terminal',
    });
    adapter.dispose();
  });

  it('emits idle=true once the probe crosses the threshold', async () => {
    const idleFn = jest.fn();
    const adapter = new WaylandAdapter({
      windowProbe: fakeWindowProbe([null]),
      idleProbe: {
        getIdleTimeMs: jest
          .fn<Promise<number>, []>()
          .mockResolvedValueOnce(1_000)
          .mockResolvedValueOnce(70_000),
        dispose: jest.fn(),
      },
      idleThresholdMs: 60_000,
      pollIntervalMs: 1000,
    });
    adapter.onIdleChanged(idleFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0); // first poll: not idle
    expect(idleFn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000); // second poll: idle
    expect(idleFn).toHaveBeenLastCalledWith(true);
    expect(adapter.isIdle()).toBe(true);
    adapter.dispose();
  });

  it('degrades to null when the window probe is missing', async () => {
    const adapter = new WaylandAdapter({
      windowProbe: null,
      pollIntervalMs: 1000,
    });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    adapter.dispose();
  });

  it('degrades to null when the probe call fails instead of throwing', async () => {
    const failing: WindowProbe = {
      getActiveWindow: jest.fn(async () => {
        throw new Error('no extension');
      }),
      dispose: jest.fn(),
    };
    const adapter = new WaylandAdapter({ windowProbe: failing, pollIntervalMs: 1000 });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    adapter.dispose();
  });

  it('reports "no window" (null) when only empty strings come back', async () => {
    const adapter = new WaylandAdapter({
      windowProbe: fakeWindowProbe([{ title: '', appId: '' }]),
      pollIntervalMs: 1000,
    });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    adapter.dispose();
  });

  it('dispose() stops further polling (initial poll still runs once)', async () => {
    const probe = fakeWindowProbe([{ title: 'A', appId: 'app.a' }]);
    const adapter = new WaylandAdapter({ windowProbe: probe, pollIntervalMs: 1000 });
    adapter.start();
    expect(probe.getActiveWindow).toHaveBeenCalledTimes(1); // immediate first poll
    adapter.dispose();
    await jest.advanceTimersByTimeAsync(1000);
    expect(probe.getActiveWindow).toHaveBeenCalledTimes(1);
  });

  runAdapterContractTests(
    'WaylandAdapter',
    () => new WaylandAdapter({ windowProbe: fakeWindowProbe([]), idleProbe: fakeIdleProbe([]) }),
  );
});
