import { Writable } from 'node:stream';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface AgentLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/**
 * Minimal structured logger writing single-line JSON to a stream.
 * The agent is a plain Node process (no NestJS), so this replaces
 * `console.log` (design doc §8.2 structured logging).
 */
export class JsonLogger implements AgentLogger {
  constructor(
    private readonly stream: Writable = process.stderr,
    private readonly minLevel: LogLevel = 'info',
  ) {}

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write('error', message, fields);
  }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
    this.stream.write(`${line}\n`);
  }
}

export function createLogger(minLevel: LogLevel = 'info'): AgentLogger {
  return new JsonLogger(process.stderr, minLevel);
}

export const SILENT_LOGGER: AgentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
