import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CommandRunner, CommandOutput } from '../command-runner';
import { runAdapterContractTests } from '../testing/contract';
import { X11Adapter } from './x11-adapter';
import { IdleProbe } from '../dbus/session-probe';

function scriptedRunner(
  steps: Array<{ cmd: string; args: string[]; stdout?: string; error?: boolean }>,
) {
  let i = 0;
  return {
    run: jest.fn(async (_cmd: string, _args: string[]): Promise<CommandOutput> => {
      const step = steps[i++];
      if (!step || step.error) {
        if (step?.error) throw new Error(`command failed: ${_cmd}`);
        return { stdout: '', stderr: '' };
      }
      return { stdout: step.stdout ?? '', stderr: '' };
    }),
  } as unknown as { run: jest.Mock } & CommandRunner;
}

function fakeIdleProbe(values: number[]): IdleProbe {
  let i = 0;
  return {
    getIdleTimeMs: jest.fn(async () => values[i++] ?? 0),
    dispose: jest.fn(),
  };
}

describe('X11Adapter', () => {
  const originalDisplay = process.env.DISPLAY;

  beforeEach(() => {
    process.env.DISPLAY = ':1';
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (originalDisplay === undefined) delete process.env.DISPLAY;
    else process.env.DISPLAY = originalDisplay;
    jest.useRealTimers();
  });

  const steps = () => [
    {
      cmd: 'xprop',
      args: ['-root', '_NET_ACTIVE_WINDOW'],
      stdout: '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x360',
    },
    {
      cmd: 'xprop',
      args: ['-id', '0x360', '_NET_WM_NAME', 'WM_NAME', '_NET_WM_PID'],
      stdout: ['_NET_WM_PID(CARDINAL) = 1234', '_NET_WM_NAME(UTF8_STRING) = "hello"'].join('\n'),
    },
  ];

  it('returns null before any poll', () => {
    const adapter = new X11Adapter({
      commandRunner: scriptedRunner([]),
      idleProbe: fakeIdleProbe([]),
    });
    expect(adapter.getActiveWindow()).toBeNull();
    expect(adapter.isIdle()).toBe(false);
  });

  it('caches the focused window title + comm after a poll', async () => {
    const runner = scriptedRunner(steps());
    const adapter = new X11Adapter({
      commandRunner: runner,
      idleProbe: fakeIdleProbe([0]),
      readComm: async () => 'green.app',
      pollIntervalMs: 1000,
    });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toEqual({
      title: 'hello',
      processName: 'green.app',
    });
    adapter.dispose();
  });

  it('emits idle=true once the probe crosses the threshold', async () => {
    const idleFn = jest.fn();
    const runner = scriptedRunner(steps());
    const adapter = new X11Adapter({
      commandRunner: runner,
      idleProbe: {
        getIdleTimeMs: jest
          .fn<() => Promise<number>>()
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

  it('degrades to null when xprop fails instead of throwing', async () => {
    const runner = scriptedRunner([
      { cmd: 'xprop', args: ['-root', '_NET_ACTIVE_WINDOW'], error: true },
    ]);
    const adapter = new X11Adapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    adapter.dispose();
  });

  it('dispose() stops further polling (initial poll still runs once)', async () => {
    const runner = scriptedRunner([]);
    const adapter = new X11Adapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    expect(runner.run).toHaveBeenCalledTimes(1); // immediate first poll
    adapter.dispose();
    await jest.advanceTimersByTimeAsync(1000);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  runAdapterContractTests(
    'X11Adapter',
    () => new X11Adapter({ commandRunner: scriptedRunner([]), idleProbe: fakeIdleProbe([]) }),
  );
});

describe('X11Adapter without DISPLAY', () => {
  it('keeps active window null even if xprop returns data', async () => {
    const original = process.env.DISPLAY;
    delete process.env.DISPLAY;
    jest.useFakeTimers();

    const runner = scriptedRunner([
      {
        cmd: 'xprop',
        args: ['-root', '_NET_ACTIVE_WINDOW'],
        stdout: '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x5',
      },
      {
        cmd: 'xprop',
        args: ['-id', '0x5', '_NET_WM_NAME', 'WM_NAME', '_NET_WM_PID'],
        stdout: '_NET_WM_NAME(UTF8_STRING) = "should not be read"',
      },
    ]);
    const adapter = new X11Adapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    expect(runner.run).not.toHaveBeenCalled();

    adapter.dispose();
    jest.useRealTimers();
    if (original === undefined) delete process.env.DISPLAY;
    else process.env.DISPLAY = original;
  });
});
