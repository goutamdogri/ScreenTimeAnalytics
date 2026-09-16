import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { RawEventPayload } from '@screen-time/core';

/**
 * Durable event buffer: an append-only JSONL spool on disk.
 *
 * The agent never holds events only in memory — if the process dies, the
 * spool survives and is re-synced on restart (design doc §7.2 "spool remit").
 *
 * Reads take an exclusive mutex so `peek`/`trim` never interleave
 * mid-write; appends are sequential by construction.
 */
export class EventBuffer {
  private readonly filePath: string;
  private chain: Promise<void> = Promise.resolve();

  constructor(spoolDir: string, fileName = 'events.jsonl') {
    this.filePath = join(spoolDir, fileName);
  }

  async append(record: RawEventPayload): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await this.serial(() => appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8'));
  }

  private async readLines(): Promise<string[]> {
    try {
      const raw = await this.serial(() => readFile(this.filePath, 'utf8'));
      return raw.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async count(): Promise<number> {
    return (await this.readLines()).length;
  }

  async peek(limit: number): Promise<RawEventPayload[]> {
    const lines = await this.readLines();
    return lines.slice(0, limit).map((line) => JSON.parse(line) as RawEventPayload);
  }

  /** Remove the given number of events from the front of the spool. */
  async trim(count: number): Promise<void> {
    await this.serial(async () => {
      if (count <= 0) return;
      let remaining = '';
      try {
        const raw = await readFile(this.filePath, 'utf8');
        remaining = raw.split('\n').filter(Boolean).slice(count).join('\n');
      } catch {
        return;
      }
      if (remaining.length > 0) remaining += '\n';
      await writeFile(this.filePath, remaining, 'utf8');
    });
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
