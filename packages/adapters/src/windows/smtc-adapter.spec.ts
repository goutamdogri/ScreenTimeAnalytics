import { NowPlayingInfo } from '../index';
import { CommandOutput, CommandRunner } from '../command-runner';
import { SmtcAdapter } from './smtc-adapter';
import { runAdapterContractTests } from '../testing/contract';

const NOW_PLAYING_JSON = (title: string, artist: string): string =>
  `{"hasMedia":true,"title":"${title}","artist":"${artist}","sourceApp":"Spotify.exe","durationSeconds":228}`;

function scriptedPowershell(stdout: string[]): { run: jest.Mock } & CommandRunner {
  let i = 0;
  return {
    run: jest.fn(async (): Promise<CommandOutput> => {
      const output = stdout[Math.min(i++, stdout.length - 1)] ?? '{}';
      return { stdout: output, stderr: '' };
    }),
  } as { run: jest.Mock } & CommandRunner;
}

describe('SmtcAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits media events when metadata appears for the first time', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const adapter = new SmtcAdapter({
      commandRunner: scriptedPowershell([NOW_PLAYING_JSON('Blinding Lights', 'The Weeknd')]),
      pollIntervalMs: 1000,
    });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(mediaFn).toHaveBeenCalledTimes(1);
    const payload = mediaFn.mock.calls[0]![0] as NowPlayingInfo;
    expect(payload).toMatchObject({ trackTitle: 'Blinding Lights', artist: 'The Weeknd' });
    adapter.dispose();
  });

  it('does not re-emit when nothing changed', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const same = NOW_PLAYING_JSON('Static', 'Artist');
    const adapter = new SmtcAdapter({
      commandRunner: scriptedPowershell([same, same]),
      pollIntervalMs: 1000,
    });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);

    expect(mediaFn).toHaveBeenCalledTimes(1);
    adapter.dispose();
  });

  it('emits null when the media session disappears', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const adapter = new SmtcAdapter({
      commandRunner: scriptedPowershell([
        NOW_PLAYING_JSON('Goodbye', 'Artist'),
        '{"hasMedia":false}',
      ]),
      pollIntervalMs: 1000,
    });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);

    const finalCalls = mediaFn.mock.calls.map((c) => c[0]);
    expect(finalCalls).toContain(null);
    adapter.dispose();
  });

  it('degrades silently when the probe throws', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const runner: CommandRunner = {
      run: jest.fn(async () => {
        throw new Error('probe failed');
      }),
    };
    const adapter = new SmtcAdapter({ commandRunner: runner, pollIntervalMs: 1000 });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(mediaFn).not.toHaveBeenCalled();
    expect(adapter.getNowPlaying()).toBeNull();
    adapter.dispose();
  });

  it('getActiveWindow() is always null', () => {
    const adapter = new SmtcAdapter({ commandRunner: scriptedPowershell([]) });
    expect(adapter.getActiveWindow()).toBeNull();
  });

  runAdapterContractTests(
    'SmtcAdapter',
    () => new SmtcAdapter({ commandRunner: scriptedPowershell([]) }),
  );
});
