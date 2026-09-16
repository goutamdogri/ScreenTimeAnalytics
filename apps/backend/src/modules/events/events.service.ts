import { Injectable } from '@nestjs/common';
import { Prisma } from '@screen-time/db';
import { RawEventPayload } from '@screen-time/core';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../classification/classification.service';

export interface IngestResult {
  accepted: number;
  duplicates: number;
}

/**
 * Persists raw OA observation batches. Idempotency is delegated to the
 * `(device_id, timestamp, source)` unique index with `skipDuplicates`, so a
 * retried batch never double-counts (design doc §8.4).
 *
 * Rule-based categorization (design doc §3.2 step 1) runs synchronously per
 * event here — it is a pure, millisecond-level function — so every accepted
 * event is stored with its deterministic category. Rows the rule engine can't
 * resolve are left uncategorized and picked up later by the async content-layer
 * worker (design doc §3.2 step 2), keeping ingest latency independent of LLM
 * calls.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classification: ClassificationService,
  ) {}

  async ingest(deviceId: string, events: RawEventPayload[]): Promise<IngestResult> {
    if (events.length === 0) {
      return { accepted: 0, duplicates: 0 };
    }

    const created = await this.prisma.rawEvent.createMany({
      data: events.map((e) => {
        const classification = this.classification.classify({
          source: e.source,
          eventType: e.eventType,
          app: e.app ?? null,
          url: this.eventUrl(e),
          windowTitle: e.windowTitle ?? null,
        });
        return {
          deviceId,
          timestamp: new Date(e.timestamp),
          source: e.source,
          eventType: e.eventType,
          app: e.app,
          windowTitle: e.windowTitle,
          url: e.url,
          category: classification.category,
          subCategory: classification.subCategory,
          metadata:
            e.metadata === undefined ? undefined : (e.metadata as unknown as Prisma.InputJsonValue),
        };
      }),
      skipDuplicates: true,
    });

    return { accepted: created.count, duplicates: events.length - created.count };
  }

  /** Top-level URL first; legacy agents sent it inside `metadata.url`. */
  private eventUrl(event: RawEventPayload): string | null {
    if (event.url) {
      return event.url;
    }
    const metadataUrl = event.metadata?.url;
    return typeof metadataUrl === 'string' && metadataUrl.length > 0 ? metadataUrl : null;
  }
}
