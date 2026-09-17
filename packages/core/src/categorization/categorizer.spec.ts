import { categorizeEvent } from './categorizer';
import { Category } from './categories';

function browse(url: string) {
  return categorizeEvent({ source: 'extension', eventType: 'browse', url });
}

describe('categorizeEvent', () => {
  it('maps idle to idle_afk (state-level rule)', () => {
    const result = categorizeEvent({ source: 'x11', eventType: 'idle', app: 'system' });
    expect(result).toEqual({
      category: Category.IDLE_AFK,
      subCategory: null,
      basis: 'rule',
      confidence: 1,
    });
  });

  it.each(['wayland', 'windows'] as const)(
    'maps %s idle events to idle_afk (Phase 6 sources)',
    (source) => {
      const result = categorizeEvent({ source, eventType: 'idle', app: 'system' });
      expect(result.category).toBe(Category.IDLE_AFK);
    },
  );

  it('maps any MPRIS media event to music_audio', () => {
    const result = categorizeEvent({ source: 'mpris', eventType: 'media', app: 'spotify' });
    expect(result).toEqual({
      category: Category.MUSIC_AUDIO,
      subCategory: null,
      basis: 'rule',
      confidence: 1,
    });
  });

  it('maps Windows SMTC media events to music_audio (Phase 6 source)', () => {
    const result = categorizeEvent({ source: 'smtc', eventType: 'media', app: 'Spotify.exe' });
    expect(result.category).toBe(Category.MUSIC_AUDIO);
  });

  it('classifies a known development host as deep_work', () => {
    const result = browse('https://github.com/user/repo/pull/1');
    expect(result.category).toBe(Category.DEEP_WORK);
    expect(result.basis).toBe('rule');
  });

  it('is case/prefix tolerant on hostnames', () => {
    expect(browse('https://WWW.GitHub.com/').category).toBe(Category.DEEP_WORK);
  });

  it('puts feed-specific sub-URLs into short_form_video before the host rule', () => {
    expect(browse('https://www.instagram.com/reels/ABC/').category).toBe(Category.SHORT_FORM_VIDEO);
    expect(browse('https://www.instagram.com/goutamdogri/').category).toBe(Category.SOCIAL_MEDIA);
  });

  it('classifies youtube shorts as short_form_video', () => {
    expect(browse('https://m.youtube.com/shorts/abc123').category).toBe(Category.SHORT_FORM_VIDEO);
  });

  it('defers youtube watch content to the LLM layer', () => {
    const result = browse('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({ category: null, subCategory: null, basis: 'unknown', confidence: 0 });
  });

  it('keeps youtube music on the music path (not the content layer)', () => {
    expect(browse('https://music.youtube.com/watch?v=abc').category).toBe(Category.MUSIC_AUDIO);
  });

  it('categorizes unmatched extension browse events as browsing_research (design doc §3.1)', () => {
    expect(browse('https://some-random-domain.example/article')).toEqual({
      category: Category.BROWSING_RESEARCH,
      subCategory: null,
      basis: 'rule',
      confidence: 1,
    });
  });

  it('falls back to browsing_research for non-http browse events', () => {
    expect(browse('chrome://extensions/').category).toBe(Category.BROWSING_RESEARCH);
  });

  it('classifies focus events by app name', () => {
    const code = categorizeEvent({
      source: 'x11',
      eventType: 'focus',
      app: 'code',
      windowTitle: 'a.ts',
    });
    expect(code.category).toBe(Category.DEEP_WORK);
    const discord = categorizeEvent({ source: 'x11', eventType: 'focus', app: 'discord' });
    expect(discord.category).toBe(Category.COMMUNICATION);
  });

  it('honors app prefixes when matching', () => {
    expect(
      categorizeEvent({ source: 'x11', eventType: 'focus', app: 'jetbrains-idea' }).category,
    ).toBe(Category.DEEP_WORK);
  });

  it('leaves unmatched focus events unknown for the content layer', () => {
    const result = categorizeEvent({ source: 'x11', eventType: 'focus', app: 'some-random-app' });
    expect(result).toEqual({ category: null, subCategory: null, basis: 'unknown', confidence: 0 });
  });

  it('prefers URL rules over app rules when both are present', () => {
    const result = categorizeEvent({
      source: 'x11',
      eventType: 'focus',
      app: 'discord',
      url: 'https://github.com/foo',
    });
    expect(result.category).toBe(Category.DEEP_WORK);
  });

  it('leaves events with no signal at all unknown', () => {
    const result = categorizeEvent({ source: 'x11', eventType: 'focus' });
    expect(result.category).toBeNull();
    expect(result.basis).toBe('unknown');
  });
});
