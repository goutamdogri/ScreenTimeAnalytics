/**
 * Minimal structured logging surface for adapters.
 *
 * Adapters must stay framework-agnostic (they are consumed by the plain-Node
 * desktop agent), so instead of depending on NestJS's `Logger` they accept any
 * logger exposing these methods and fall back to a silent no-op.
 */
export interface AdapterLogger {
  debug(message: string): void;
  warn(message: string): void;
}

export const SILENT_LOGGER: AdapterLogger = {
  debug: () => {},
  warn: () => {},
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
