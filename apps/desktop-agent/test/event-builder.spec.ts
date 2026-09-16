import { describe, expect, it } from '@jest/globals';
import { browseEvent, focusEvent, idleEvent, mediaEvent } from '../src/event-builder';

const TS = '2026-02-01T10:00:00.000Z';

describe('event builders', () => {
  it('focusEvent maps a window snapshot', () => {
    expect(focusEvent(TS, { title: 'Terminal', processName: 'alacritty' })).toEqual({
      timestamp: TS,
      source: 'x11',
      eventType: 'focus',
      app: 'alacritty',
      windowTitle: 'Terminal',
    });
  });

  it('idleEvent records the idle edge', () => {
    expect(idleEvent(TS, true)).toMatchObject({
      source: 'x11',
      eventType: 'idle',
      app: 'system',
      metadata: { idle: true },
    });
    expect(idleEvent(TS, false)).toMatchObject({ metadata: { idle: false } });
  });

  it('mediaEvent includes now-playing metadata and maps null to stopped', () => {
    expect(
      mediaEvent(TS, {
        trackTitle: 'Blinding Lights',
        artist: 'The Weeknd',
        sourceApp: 'org.mpris.MediaPlayer2.spotify',
        durationSeconds: 228,
      }),
    ).toEqual({
      timestamp: TS,
      source: 'mpris',
      eventType: 'media',
      app: 'org.mpris.MediaPlayer2.spotify',
      windowTitle: 'Blinding Lights',
      metadata: { artist: 'The Weeknd', durationSeconds: 228 },
    });

    expect(mediaEvent(TS, null)).toMatchObject({
      source: 'mpris',
      eventType: 'media',
      app: 'system',
      metadata: { state: 'stopped' },
    });
  });

  it('browseEvent captures url/title from the extension', () => {
    expect(browseEvent({ url: 'https://example.com/docs', title: 'Docs', timestamp: TS })).toEqual({
      timestamp: TS,
      source: 'extension',
      eventType: 'browse',
      app: 'browser',
      url: 'https://example.com/docs',
      windowTitle: 'Docs',
      metadata: { url: 'https://example.com/docs', title: 'Docs' },
    });
  });
});
