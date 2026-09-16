import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassificationService, PendingEvent } from './classification.service';
import { LlmProvidersService } from '../llm/llm-providers.service';

const LLM_METHOD = 'llm';

/**
 * Async content-layer enrichment (design doc §3.2 step 2, §8.4 graceful
 * degradation).
 *
 * Runs on a polling interval inside the backend process — no external queue.
 * Every tick drains rows whose events are uncategorized (the rule layer missed)
 * for users who have configured an LLM provider. Rule hits are never seen here:
 * `EventsService` classifies them synchronously at ingest. Ingest performance is
 * therefore never coupled to LLM latency.
 */
@Injectable()
export class ClassificationWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ClassificationWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private tickRunning = false;
  private readonly shutdown = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly classification: ClassificationService,
    private readonly llmProviders: LlmProvidersService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.configService.get<boolean>('classification.workerEnabled')) {
      this.logger.log('Classification worker disabled (CLASSIFICATION_WORKER_DISABLED=1)');
      return;
    }
    const interval = this.configService.get<number>('classification.pollIntervalMs');
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    this.timer.unref?.();
    void this.tick();
    this.logger.log(`Classification worker started (poll every ${interval}ms)`);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.tickRunning || this.shutdown) {
      return;
    }
    this.tickRunning = true;
    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error(`Classification tick failed: ${(error as Error).message}`);
    } finally {
      this.tickRunning = false;
    }
  }

  private async processBatch(): Promise<void> {
    const batchSize = this.configService.getOrThrow<number>('classification.batchSize');
    let processed = 0;

    // Repeatedly drain the queue until an empty batch is returned (pending
    // rows are newly created faster than one tick can process during bursts).
    while (true) {
      const pending = await this.classification.findPending(batchSize);
      if (pending.length === 0) {
        break;
      }
      for (const event of pending) {
        try {
          await this.enrich(event);
          processed += 1;
        } catch (error) {
          // One bad event must never take down the worker (design doc §8.4).
          this.logger.warn(
            `Skipping classification of event ${event.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    if (processed > 0) {
      this.logger.log(`Classified ${processed} uncategorized events`);
    }
  }

  private async enrich(event: PendingEvent): Promise<void> {
    const url = this.candidateUrl(event);
    const title = event.windowTitle ?? this.classification.metadataString(event.metadata, 'title');

    if (!url && !title) {
      return;
    }

    // Cache first: nothing is re-classified twice (design doc §3.2).
    if (url) {
      const cached = await this.classification.findCached(url);
      if (cached) {
        await this.classification.apply(event.id, {
          category: cached.category,
          subCategory: cached.subCategory,
        });
        return;
      }
    }

    const provider = await this.llmProviders.buildProviderForUser(event.device.userId);
    if (!provider) {
      return;
    }

    const classification = await provider.classify(url ?? '', title ?? '');
    const stored = this.classification.fromLlm(classification);
    if (stored.category === null) {
      this.logger.warn(
        `LLM returned an unusable classification for event ${event.id} (category=${classification.category}, confidence=${classification.confidence})`,
      );
      return;
    }

    await this.classification.apply(event.id, stored);
    if (url) {
      await this.classification.writeCache(url, stored, LLM_METHOD);
    }
  }

  /** Top-level URL first; legacy events carried it inside `metadata.url`. */
  private candidateUrl(event: PendingEvent): string | null {
    return event.url ?? this.classification.metadataString(event.metadata, 'url');
  }
}
