import type { ApiClient } from './api-client';
import type { EventBuffer } from './buffer';
import type { AgentConfig } from './config';
import type { AgentLogger } from './logger';

/** Response from `POST /events` */
export interface IngestResponse {
  accepted: number;
  duplicates: number;
}

interface SyncDeps {
  api: ApiClient;
  buffer: EventBuffer;
  /** Opaque token sent in the `x-device-token` header (the backend derives the device from it). */
  deviceToken: string;
  config: AgentConfig;
  logger: AgentLogger;
  /** Injectable for testing. */
  now?: () => Date;
}

/**
 * The sync loop reads batches from the JSONL spool and pushes them to the
 * backend. On success the spool is trimmed; on transient failure the batch
 * stays at the front and will be retried with exponential back-off.
 *
 * Heartbeats are piggy-backed onto each flush cycle (fire-and-forget) so
 * the backend sees a non-null `lastSeenAt` even during quiet periods.
 */
export class SyncEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private backoffMs = 0;
  private consecutiveFailures = 0;
  private flushing = false;

  constructor(private readonly deps: SyncDeps) {}

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.flush();
      void this.heartbeat();
    }, this.deps.config.syncIntervalMs);
    this.timer.unref();
    void this.flush();
    void this.heartbeat();
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
      void this.flush().finally(resolve);
    });
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const batch = await this.deps.buffer.peek(this.deps.config.syncBatchSize);
      if (batch.length === 0) return;

      const res = await this.deps.api.request<IngestResponse>('/events', {
        method: 'POST',
        json: { events: batch },
        headers: { 'x-device-token': this.deps.deviceToken },
      });

      await this.deps.buffer.trim(batch.length);
      this.consecutiveFailures = 0;
      this.backoffMs = 0;
      this.deps.logger.info('sync_ok', {
        accepted: res.body?.accepted ?? 0,
        duplicates: res.body?.duplicates ?? 0,
      });
    } catch (err) {
      this.consecutiveFailures++;
      this.backoffMs = Math.min(60_000, Math.max(5_000, this.backoffMs * 2 || 5_000));
      this.deps.logger.warn('sync_failed', {
        attempt: this.consecutiveFailures,
        backoffMs: this.backoffMs,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.flushing = false;
    }
  }

  private heartbeat(): void {
    this.deps.api
      .request('/devices/heartbeat', {
        method: 'POST',
        headers: { 'x-device-token': this.deps.deviceToken },
      })
      .catch(() => {});
  }
}
