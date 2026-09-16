import { NowPlayingInfo } from '../index';
import { MprisAdapter } from './mpris-adapter';
import { MprisBus } from '../dbus/session-probe';
import { runAdapterContractTests } from '../testing/contract';

function fakeBus(values: Record<string, unknown>[]): MprisBus {
  let i = 0;
  return {
    listPlayerNames: jest.fn(async () =>
      values.length > 0 ? ['org.mpris.MediaPlayer2.spotify'] : [],
    ),
    getPlayerMetadata: jest.fn(async () => values[Math.min(i++, values.length - 1)] ?? {}),
    dispose: jest.fn(),
  };
}

describe('MprisAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits media events when metadata appears for the first time', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const bus = fakeBus([
      { 'xesam:title': { value: 'Blinding Lights' }, 'xesam:artist': { value: ['The Weeknd'] } },
    ]);
    const adapter = new MprisAdapter({ bus, pollIntervalMs: 1000 });
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
    const same = { 'xesam:title': { value: 'Static' } };
    const bus = fakeBus([same, same]);
    const adapter = new MprisAdapter({ bus, pollIntervalMs: 1000 });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);

    expect(mediaFn).toHaveBeenCalledTimes(1);
    adapter.dispose();
  });

  it('emits null when the last player disappears', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const bus = {
      listPlayerNames: jest
        .fn<Promise<string[]>, []>()
        .mockResolvedValueOnce(['org.mpris.MediaPlayer2.spotify'])
        .mockResolvedValueOnce([]),
      getPlayerMetadata: jest
        .fn<Promise<Record<string, { value: string }>>, [name: string]>()
        .mockResolvedValue({ 'xesam:title': { value: 'Goodbye' } }),
      dispose: jest.fn(),
    } as unknown as MprisBus;
    const adapter = new MprisAdapter({ bus, pollIntervalMs: 1000 });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);

    const finalCalls = mediaFn.mock.calls.map((c) => c[0]);
    expect(finalCalls).toContain(null);
    adapter.dispose();
  });

  it('getActiveWindow() is always null', () => {
    const adapter = new MprisAdapter({ bus: fakeBus([]) });
    expect(adapter.getActiveWindow()).toBeNull();
  });

  runAdapterContractTests('MprisAdapter', () => new MprisAdapter({ bus: fakeBus([]) }));
});

describe('MprisAdapter contract with no players', () => {
  it('never emits when there are no players', async () => {
    const mediaFn = jest.fn<void, [info: NowPlayingInfo | null]>();
    const adapter = new MprisAdapter({ bus: fakeBus([]), pollIntervalMs: 1000 });
    adapter.onMediaChanged(mediaFn);
    adapter.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(mediaFn).not.toHaveBeenCalled();
    adapter.dispose();
  });
});
