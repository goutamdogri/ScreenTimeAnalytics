import {
  parseActiveWindowOutput,
  parseIdleMillisOutput,
  parseNowPlayingOutput,
  powershellCommandArgs,
} from './powershell-scripts';

describe('powershell script builders', () => {
  it('passes the script through -Command with a quiet profile', () => {
    const args = powershellCommandArgs('Write-Output "hi"');
    expect(args).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Write-Output "hi"',
    ]);
  });
});

describe('parseActiveWindowOutput', () => {
  it('parses title + process name', () => {
    expect(parseActiveWindowOutput('{"title":"Terminal","processName":"WindowsTerminal"}')).toEqual(
      {
        title: 'Terminal',
        processName: 'WindowsTerminal',
      },
    );
  });

  it('returns null when no window is focused', () => {
    expect(parseActiveWindowOutput('{"title":"","processName":""}')).toBeNull();
  });

  it('falls back to the other field when one is empty', () => {
    expect(parseActiveWindowOutput('{"title":"","processName":"explorer"}')).toEqual({
      title: 'explorer',
      processName: 'explorer',
    });
  });

  it('returns null on garbage/empty output instead of throwing', () => {
    expect(parseActiveWindowOutput('')).toBeNull();
    expect(parseActiveWindowOutput('not json')).toBeNull();
    expect(parseActiveWindowOutput('[]')).toBeNull();
  });
});

describe('parseIdleMillisOutput', () => {
  it('parses the idle duration', () => {
    expect(parseIdleMillisOutput('{"idleMs": 42000}')).toBe(42000);
  });

  it('returns -1 on failure (signal "unknown")', () => {
    expect(parseIdleMillisOutput('nope')).toBe(-1);
    expect(parseIdleMillisOutput('{"idleMs":"oops"}')).toBe(-1);
  });
});

describe('parseNowPlayingOutput', () => {
  it('parses SMTC media metadata', () => {
    expect(
      parseNowPlayingOutput(
        '{"hasMedia":true,"title":"Blinding Lights","artist":"The Weeknd","sourceApp":"Spotify.exe","durationSeconds":228}',
      ),
    ).toEqual({
      trackTitle: 'Blinding Lights',
      artist: 'The Weeknd',
      sourceApp: 'Spotify.exe',
      durationSeconds: 228,
    });
  });

  it('returns null when there is no media session', () => {
    expect(parseNowPlayingOutput('{"hasMedia":false}')).toBeNull();
  });

  it('returns null when nothing has a title', () => {
    expect(
      parseNowPlayingOutput('{"hasMedia":true,"title":"","artist":"","sourceApp":""}'),
    ).toBeNull();
  });

  it('returns null on garbage/empty output instead of throwing', () => {
    expect(parseNowPlayingOutput('')).toBeNull();
    expect(parseNowPlayingOutput('{"unexpected":true}')).toBeNull();
  });
});
