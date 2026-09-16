import { parseActiveWindowId, parseWindowMeta } from './x11-parser';

describe('parseActiveWindowId', () => {
  it.each([
    ['_NET_ACTIVE_WINDOW(WINDOW): window id # 0x3600007', '0x3600007'],
    ['_NET_ACTIVE_WINDOW(WINDOW): window id # 0x63', '0x63'],
    ['_NET_ACTIVE_WINDOW(WINDOW): window id # 0', '0'],
  ])('parses %j → %j', (input, expected) => {
    expect(parseActiveWindowId(input)).toBe(expected);
  });

  it('returns null when no window is reported', () => {
    expect(parseActiveWindowId('_NET_ACTIVE_WINDOW:  no window')).toBeNull();
    expect(parseActiveWindowId('')).toBeNull();
  });
});

describe('parseWindowMeta', () => {
  it('extracts title and pid', () => {
    const out = [
      '_NET_WM_PID(CARDINAL) = 4321',
      'WM_NAME(STRING) = "My Window"',
      '_NET_WM_NAME(UTF8_STRING) = "My Window"',
    ].join('\n');
    expect(parseWindowMeta(out)).toEqual({ title: 'My Window', pid: '4321' });
  });

  it('prefers _NET_WM_NAME over WM_NAME', () => {
    const out = ['WM_NAME(STRING) = "old"', '_NET_WM_NAME(UTF8_STRING) = "new"'].join('\n');
    expect(parseWindowMeta(out).title).toBe('new');
  });

  it('handles unquoted titles (rare xprop formats)', () => {
    const out = '_NET_WM_NAME(UTF8_STRING) =CodeVSCode';
    expect(parseWindowMeta(out).title).toBe('CodeVSCode');
  });

  it('treats missing/empty/none titles as null', () => {
    expect(parseWindowMeta('WM_NAME:  (null)').title).toBeNull(); // no '='
    expect(parseWindowMeta('').title).toBeNull();
    expect(parseWindowMeta('_NET_WM_NAME(UTF8_STRING) = 0x0').title).toBeNull();
    expect(parseWindowMeta('_NET_WM_NAME(UTF8_STRING) = (none)').title).toBeNull();
  });

  it('handles pid-only output (title absent)', () => {
    expect(parseWindowMeta('_NET_WM_PID(CARDINAL) = 7').title).toBeNull();
    expect(parseWindowMeta('_NET_WM_PID(CARDINAL) = 7').pid).toBe('7');
  });
});
