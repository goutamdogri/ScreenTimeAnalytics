import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsFinalizerService } from './sessions.finalizer.service';

/**
 * Background poller that derives + closes sessions and settles gamification
 * (design doc §4, §6 and the `SessionFinalizerWorker` decision).
 *
 * Mirrors the classification worker's lifecycle: polls on an interval inside
 * the backend process (no external queue), degrades gracefully per device, and
 * can be disabled via `SESSION_FINALIZER_DISABLED=1` (used by e2e tests).
 */
@Injectable()
export class SessionFinalizerWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SessionFinalizerWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private tickRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly finalizer: SessionsFinalizerService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.configService.get<boolean>('sessions.finalizerEnabled')) {
      this.logger.log('Session finalizer worker disabled (SESSION_FINALIZER_DISABLED=1)');
      return;
    }
    const interval = this.configService.get<number>('sessions.pollIntervalMs');
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    this.timer.unref?.();
    void this.tick();
    this.logger.log(`Session finalizer worker started (poll every ${interval}ms)`);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.tickRunning) {
      return;
    }
    this.tickRunning = true;
    try {
      const result = await this.finalizer.finalizeAllDevices();
      if (result.closedSessions > 0) {
        this.logger.log(
          `Finalized ${result.closedSessions} session(s) across ${result.devices} device(s)`,
        );
      }
    } catch (error) {
      this.logger.error(`Session finalizer tick failed: ${(error as Error).message}`);
    } finally {
      this.tickRunning = false;
    }
  }
}
