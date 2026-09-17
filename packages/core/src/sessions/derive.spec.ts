import { Category } from '../categorization/categories';
import {
  appendToWindow,
  deriveSessions,
  finalizeWindow,
  sessionWindowFromSnapshot,
  sessionWindowToSnapshot,
  SESSION_GAP_MS,
} from './derive';
import type { SessionInputRow, SessionWindow } from './derive';

const MS = 60 * 1000;

function row(minutesFromBase: number, partial: Partial<SessionInputRow> = {}): SessionInputRow {
  return {
    timestamp: new Date(1_000_000 * MS + minutesFromBase * MS),
    app: null,
    windowTitle: null,
    category: Category.DEEP_WORK,
    subCategory: null,
    source: 'x11',
    ...partial,
  };
}

const BASE = new Date(1_000_000 * MS);

describe('deriveSessions', () => {
  it('merges events within the 5-minute gap into one session', () => {
    const { closed, open } = deriveSessions(
      [
        row(0, { app: 'code', windowTitle: 'a.ts', category: Category.DEEP_WORK }),
        row(1, { app: 'code', windowTitle: 'b.ts', category: Category.DEEP_WORK }),
        row(2, { app: 'slack', windowTitle: '#general', category: Category.COMMUNICATION }),
      ],
      new Date(BASE.getTime() + 30 * MS),
    );
    expect(closed).toHaveLength(1);
    expect(open).toBeNull();
    const session = closed[0]!;
    expect(session.durationMin).toBe(2);
    // Mode extraction: code appears twice.
    expect(session.app).toBe('code');
    expect(session.category).toBe(Category.DEEP_WORK);
    // Distinct minutes: minute0 (code), minute1 (code+slack share) -> code 2, slack 1.
    expect(session.appMinutes).toEqual({ code: 2, slack: 1 });
  });

  it('splits sessions when the gap exceeds 5 minutes', () => {
    const { closed } = deriveSessions(
      [row(0, { app: 'code' }), row(SESSION_GAP_MS / MS + 1, { app: 'terminal' })],
      new Date(BASE.getTime() + 30 * MS),
    );
    expect(closed).toHaveLength(2);
    expect(closed[0]?.app).toBe('code');
    expect(closed[1]?.app).toBe('terminal');
  });

  it('keeps the trailing window open while silence is shorter than the gap', () => {
    const last = row(0);
    const { closed, open } = deriveSessions([last], new Date(last.timestamp.getTime() + 2 * MS));
    expect(closed).toHaveLength(0);
    expect(open).not.toBeNull();
  });

  it('closes the trailing window once silence reaches the gap', () => {
    const last = row(0);
    const cutoff = new Date(last.timestamp.getTime() + (SESSION_GAP_MS + 1));
    const { closed, open } = deriveSessions([last], cutoff);
    expect(closed).toHaveLength(1);
    expect(open).toBeNull();
  });

  it('extends the window backwards for late, out-of-order events', () => {
    const window: SessionWindow = {
      startedAt: row(3).timestamp,
      endedAt: row(4).timestamp,
      events: [row(3), row(4)],
    };
    appendToWindow(window, row(1, { app: 'code' }));
    expect(window.startedAt.getTime()).toBe(row(1).timestamp.getTime());
    expect(window.events).toHaveLength(3);
  });

  it('finalizes a window with mode-selected fields and rounded duration', () => {
    const window: SessionWindow = {
      startedAt: row(0).timestamp,
      endedAt: row(3).timestamp,
      events: [row(0, { app: 'neovim' }), row(3, { app: 'neovim' })],
    };
    const session = finalizeWindow(window);
    expect(session.durationMin).toBe(3);
    expect(session.app).toBe('neovim');
    expect(session.appMinutes).toEqual({ neovim: 2 });
  });

  it('round-trips the open cursor through a JSON snapshot', () => {
    const window: SessionWindow = {
      startedAt: row(1, { app: 'code' }).timestamp,
      endedAt: row(2, { app: 'code' }).timestamp,
      events: [
        row(1, { app: 'code', windowTitle: 'x.ts', subCategory: null }),
        row(2, { app: 'code', windowTitle: 'y.ts' }),
      ],
    };
    const restored = sessionWindowFromSnapshot(sessionWindowToSnapshot(window));
    expect(restored.startedAt.getTime()).toBe(window.startedAt.getTime());
    expect(restored.endedAt.getTime()).toBe(window.endedAt.getTime());
    expect(restored.events).toHaveLength(2);
    expect(restored.events[0]?.app).toBe('code');
  });

  it('rejects an empty snapshot', () => {
    expect(() => sessionWindowFromSnapshot([])).toThrow(/empty snapshot/);
  });
});
