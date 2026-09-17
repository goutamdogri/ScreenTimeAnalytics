import { CommandOutput, CommandRunner } from '../command-runner';
import { WindowsAdapter } from './windows-adapter';
import { runAdapterContractTests } from '../testing/contract';

/**
 * Fake CommandRunner that answers based on which PowerShell probe is invoked
 * (matching a distinctive token in the script body).
 */
function scriptedPowershell(
  windowJson: string,
  idleJson: string,
): { run: jest.Mock } & CommandRunner {
  return {
    run: jest.fn(async (_cmd: string, args: string[]): Promise<CommandOutput> => {
      const script = args.join(' ');
      if (script.includes('GetForegroundWindow')) return { stdout: windowJson, stderr: '' };
      if (script.includes('GetLastInputInfo')) return { stdout: idleJson, stderr: '' };
      throw new Error(`unknown probe: ${script.slice(0, 40)}`);
    }),
  } as { run: jest.Mock } & CommandRunner;
}

describe('WindowsAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null before any poll', () => {
    const adapter = new WindowsAdapter({ commandRunner: scriptedPowershell('{}', '{}') });
    expect(adapter.getActiveWindow()).toBeNull();
    expect(adapter.isIdle()).toBe(false);
    adapter.dispose();
  });

  it('caches the focused window after a poll', async () => {
    const runner = scriptedPowershell('{"title":"Terminal","processName":"WindowsTerminal"}', '{}');
    const adapter = new WindowsAdapter({
      commandRunner: runner,
      pollIntervalMs: 1000,
    });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toEqual({
      title: 'Terminal',
      processName: 'WindowsTerminal',
    });
    adapter.dispose();
  });

  it('emits idle=true once the probe crosses the threshold', async () => {
    const idleFn = jest.fn();
    const runner = scriptedPowershell('{"title":"","processName":""}', '{"idleMs": 80000}');
    const adapter = new WindowsAdapter({
      commandRunner: runner,
      idleThresholdMs: 60_000,
      pollIntervalMs: 1000,
    });
    adapter.onIdleChanged(idleFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(idleFn).toHaveBeenLastCalledWith(true);
    expect(adapter.isIdle()).toBe(true);
    adapter.dispose();
  });

  it('degrades to null when the probe throws instead of crashing', async () => {
    const runner: CommandRunner = {
      run: jest.fn(async () => {
        throw new Error('spawn powershell.exe ENOENT');
      }),
    };
    const adapter = new WindowsAdapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    expect(adapter.isIdle()).toBe(false);
    adapter.dispose();
  });

  it('degrades to null when the probe output is unparseable', async () => {
    const runner = scriptedPowershell('garbage', 'garbage');
    const adapter = new WindowsAdapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(adapter.getActiveWindow()).toBeNull();
    adapter.dispose();
  });

  it('dispose() stops further polling (initial poll still runs once)', async () => {
    const runner = scriptedPowershell('{"title":"A","processName":"a.exe"}', '{"idleMs":5}');
    const adapter = new WindowsAdapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.start();
    adapter.dispose();
    await jest.advanceTimersByTimeAsync(1000);
    expect(runner.run).toHaveBeenCalledTimes(2); // window + idle initial poll only
  });

  runAdapterContractTests(
    'WindowsAdapter',
    () => new WindowsAdapter({ commandRunner: scriptedPowershell('{}', '{}') }),
  );
});
