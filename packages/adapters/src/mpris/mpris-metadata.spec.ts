import { mapMprisMetadata } from './mpris-metadata';

describe('mapMprisMetadata', () => {
  it('maps a fully-populated metadata object', () => {
    const raw = {
      'xesam:title': { value: 'Blinding Lights' },
      'xesam:artist': { value: ['The Weeknd', 'Daft Punk'] },
      'mpris:length': { value: 228000000 },
    };
    expect(mapMprisMetadata(raw, 'org.mpris.MediaPlayer2.spotify')).toEqual({
      trackTitle: 'Blinding Lights',
      artist: 'The Weeknd, Daft Punk',
      sourceApp: 'org.mpris.MediaPlayer2.spotify',
      durationSeconds: 228,
    });
  });

  it('treats missing artist as Unknown Artist', () => {
    expect(
      mapMprisMetadata({ 'xesam:title': { value: 'Envasion' } }, 'org.mpris.MediaPlayer2.spotify'),
    ).toEqual({
      trackTitle: 'Envasion',
      artist: 'Unknown Artist',
      sourceApp: 'org.mpris.MediaPlayer2.spotify',
      durationSeconds: 0,
    });
  });

  it('returns null when there is no title (paused/stopped player)', () => {
    expect(mapMprisMetadata({}, 'org.mpris.MediaPlayer2.chromium')).toBeNull();
    expect(
      mapMprisMetadata({ 'mpris:length': { value: '1000' } }, 'org.mpris.MediaPlayer2.chromium'),
    ).toBeNull();
  });

  it('unwraps plain (non-variant) values too', () => {
    const raw = { 'xesam:title': 'Plain Title' };
    expect(mapMprisMetadata(raw, 'player')?.trackTitle).toBe('Plain Title');
  });
});
