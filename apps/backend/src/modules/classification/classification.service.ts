import { Injectable } from '@nestjs/common';
import { categorizeEvent, CategorizeEventInput } from '@screen-time/core';
import { LLMClassification } from '@screen-time/llm-client';
import { ClassificationCache, Prisma } from '@screen-time/db';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Storable classification shape (mirrors `raw_events.category/sub_category`).
 * `category: null` means "leave the row unclassified" (e.g. the LLM returned an
 * unusable fallback) — the worker will not persist or cache it.
 */
export interface StoredClassification {
  category: string | null;
  subCategory: string | null;
}

export type PendingEvent = {
  id: string;
  url: string | null;
  windowTitle: string | null;
  metadata: Prisma.JsonValue | null;
  device: { userId: string };
};

/**
 * Rule + LLM content classification pipeline (design doc §3.2).
 *
 * - `classify()` applies the synchronous rule/whitelist layer — called during
 *   ingest so rule hits are stored immediately without an LLM round-trip.
 * - Cache reads/writes and event updates back up the async enrichment worker.
 */
@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pure rule-layer classification, safe to call for every ingested event. */
  classify(input: CategorizeEventInput): StoredClassification {
    const result = categorizeEvent(input);
    return { category: result.category, subCategory: result.subCategory ?? null };
  }

  /** Maps a validated LLM classification onto the storable shape. */
  fromLlm(classification: LLMClassification): StoredClassification {
    // parseLLMClassification already degrades unparsable output to
    // `{ category: other, confidence: 0 }`; a zero-confidence result means the
    // model gave us nothing usable — don't persist or cache it.
    if (classification.confidence <= 0) {
      return { category: null, subCategory: null };
    }
    return { category: classification.category, subCategory: classification.subCategory ?? null };
  }

  /**
   * Rows still awaiting the content layer: uncategorized events that carry
   * enough signal (URL or window/page title) and belong to a user with LLM
   * settings. This IS the worker's queue (design doc §3.2 step 2).
   */
  async findPending(batchSize: number): Promise<PendingEvent[]> {
    return this.prisma.rawEvent.findMany({
      where: {
        category: null,
        OR: [{ url: { not: null } }, { windowTitle: { not: null } }],
        device: { user: { llmConfig: { isNot: null } } },
      },
      orderBy: { timestamp: 'asc' },
      take: batchSize,
      select: {
        id: true,
        url: true,
        windowTitle: true,
        metadata: true,
        device: { select: { userId: true } },
      },
    }) as Promise<PendingEvent[]>;
  }

  /** Per-URL cache lookup so nothing is re-classified twice (design doc §3.2). */
  async findCached(url: string): Promise<ClassificationCache | null> {
    return this.prisma.classificationCache.findUnique({ where: { url } });
  }

  async writeCache(url: string, result: StoredClassification, method: string): Promise<void> {
    if (result.category === null) {
      return;
    }
    await this.prisma.classificationCache.upsert({
      where: { url },
      update: { category: result.category, subCategory: result.subCategory, method },
      create: { url, category: result.category, subCategory: result.subCategory, method },
    });
  }

  /** Writes the final classification back onto a raw event. */
  async apply(eventId: string, result: StoredClassification): Promise<void> {
    if (result.category === null) {
      return;
    }
    await this.prisma.rawEvent.update({
      where: { id: eventId },
      data: { category: result.category, subCategory: result.subCategory },
    });
  }

  /** Reads a metadata field of a raw event, tolerating JSON/nested shapes. */
  metadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }
    const value = (metadata as Prisma.JsonObject)[key];
    return typeof value === 'string' ? value : null;
  }
}
