import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RawEventPayload } from '@screen-time/core';

import { EventBuffer } from '../src/buffer';

describe('EventBuffer', () => {
  let dir: string;
  let buffer: EventBuffer;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sta-spool-'));
    buffer = new EventBuffer(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends JSONL records and counts them', async () => {
    await buffer.append({
      timestamp: '2026-01-01T00:00:00.000Z',
      source: 'x11',
      eventType: 'focus',
      app: 'term',
    });
    await buffer.append({
      timestamp: '2026-01-01T00:01:00.000Z',
      source: 'mpris',
      eventType: 'media',
      app: 'spotify',
    });
    expect(await buffer.count()).toBe(2);

    const lines = (await readFile(join(dir, 'events.jsonl'), 'utf8')).split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ source: 'x11', eventType: 'focus' });
  });

  it('peek returns the front of the spool in order', async () => {
    for (let i = 0; i < 5; i++) {
      await buffer.append({
        timestamp: `2026-01-01T00:00:0${i}.000Z`,
        source: 'x11',
        eventType: 'focus',
        app: 'app',
      });
    }
    const batch = await buffer.peek(3);
    expect(batch).toHaveLength(3);
    expect((batch[0] as RawEventPayload).timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect((batch[2] as RawEventPayload).timestamp).toBe('2026-01-01T00:00:02.000Z');
  });

  it('trim removes exactly count events from the front', async () => {
    for (let i = 0; i < 4; i++) {
      await buffer.append({
        timestamp: `2026-01-01T00:00:0${i}.000Z`,
        source: 'x11',
        eventType: 'focus',
        app: 'app',
      });
    }
    await buffer.trim(2);
    const rest = await buffer.peek(10);
    expect(rest.map((e) => e.timestamp)).toEqual([
      '2026-01-01T00:00:02.000Z',
      '2026-01-01T00:00:03.000Z',
    ]);
  });

  it('readers do not throw on a missing spool file', async () => {
    expect(await buffer.count()).toBe(0);
    expect(await buffer.peek(5)).toEqual([]);
    await buffer.trim(1);
    expect(await buffer.count()).toBe(0);
  });
});
