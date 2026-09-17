import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  appendToWindow,
  Category,
  DerivedSession,
  finalizeWindow,
  PendingEventSnapshot,
  SessionInputRow,
  SessionWindow,
  sessionWindowFromSnapshot,
  sessionWindowToSnapshot,
} from '@screen-time/core';
import { Prisma } from '@screen-time/db';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

export interface FinalizeResult {
  deviceId: string;
  closedSessions: number;
}

export interface FinalizeAllResult {
  devices: number;
  closedSessions: number;
}

/**
 * Session derivation + closing (design doc §6 `sessions`, the
 * `SessionFinalizerWorker`).
 *
 * Turns a device's `raw_events` clock into sessions using the 5-minute gap
 * rule, with an **open-cursor** model for crash-safety:
 *
 * - A device has at most one `open` session row carrying a `pending` snapshot
 *   of every event merged so far. New (and late) events extend it forward and
 *   backward.
 * - A window is only *closed* once a confirmed silence has passed — i.e. once
 *   the last event is `settleMs` old — so a buffered/offline agent burst that
 *   reconnects late can never split a single session.
 * - At the close flip the row is written `closed` and, in the **same
 *   transaction**, `GamificationService.syncUser` atomically settles XP,
 *   quests, boss and streak for that user (award exactly once via unique keys).
 *
 * Only events that are already categorized are materialized; rows still queued
 * for the content layer are deferred to the classification worker. This is the
 * mitigation for the rare case where an LLM reclassification lands after a
 * session was already persisted — see `docs/adr/006-gamification.md`.
 */
@Injectable()
export class SessionsFinalizerService {
  private readonly logger = new Logger(SessionsFinalizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly gamification: GamificationService,
  ) {}

  async finalizeAllDevices(now = new Date()): Promise<FinalizeAllResult> {
    const rows = await this.prisma.$queryRaw<{ device_id: string }[]>`
      SELECT DISTINCT re.device_id
      FROM raw_events re
      WHERE re.event_type = 'focus'
    `;

    let closedSessions = 0;
    for (const row of rows) {
      try {
        const result = await this.finalizeDevice(row.device_id, now);
        closedSessions += result.closedSessions;
      } catch (error) {
        this.logger.error(`Finalizing device ${row.device_id} failed: ${(error as Error).message}`);
      }
    }
    return { devices: rows.length, closedSessions };
  }

  async finalizeDevice(deviceId: string, now = new Date()): Promise<FinalizeResult> {
    const settleMs = this.configService.getOrThrow<number>('sessions.settleMs');
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, userId: true },
    });
    if (!device) {
      return { deviceId, closedSessions: 0 };
    }

    const closedSessions = await this.prisma.$transaction(async (tx) => {
      let openRow = await tx.session.findFirst({
        where: { deviceId, status: 'open' },
        orderBy: { startedAt: 'desc' },
      });

      let window: SessionWindow | null = null;
      if (openRow?.pending && Array.isArray(openRow.pending)) {
        try {
          window = sessionWindowFromSnapshot(openRow.pending as unknown as PendingEventSnapshot[]);
        } catch (error) {
          // A corrupt cursor must not wedge the device forever — drop it and let
          // the next tick rebuild from the raw events (design doc §8.4).
          this.logger.warn(
            `Dropping corrupt open cursor for device ${deviceId}: ${(error as Error).message}`,
          );
          await tx.session.delete({ where: { id: openRow.id } });
          openRow = null;
        }
      }

      const anchor = window ? window.endedAt : await this.anchor(tx, deviceId);
      const events = await tx.rawEvent.findMany({
        where: {
          deviceId,
          eventType: 'focus',
          AND: [{ category: { not: null } }, { category: { not: Category.IDLE_AFK } }],
          timestamp: { gt: anchor },
        },
        orderBy: { timestamp: 'asc' },
      });

      const closed: DerivedSession[] = [];
      for (const event of events) {
        const row: SessionInputRow = {
          timestamp: event.timestamp,
          app: event.app,
          windowTitle: event.windowTitle,
          category: event.category as string,
          subCategory: event.subCategory,
          source: event.source,
        };
        if (window === null) {
          window = { startedAt: row.timestamp, endedAt: row.timestamp, events: [row] };
          continue;
        }
        if (appendToWindow(window, row) === 'closed') {
          closed.push(finalizeWindow(window));
          window = { startedAt: row.timestamp, endedAt: row.timestamp, events: [row] };
        }
      }

      // Confirm-silence close: only flip a session when `settleMs` of real
      // silence has passed since its last event (settle >= gap).
      if (window !== null && now.getTime() - window.endedAt.getTime() >= settleMs) {
        closed.push(finalizeWindow(window));
        window = null;
      }

      let count = 0;
      if (closed.length > 0) {
        const firstClosed = closed[0]!;
        const consumesOpen =
          openRow !== null && firstClosed.startedAt.getTime() <= openRow!.startedAt.getTime();
        for (const session of closed) {
          const data = {
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationMin: session.durationMin,
            app: session.app,
            windowTitle: session.windowTitle,
            category: session.category,
            subCategory: session.subCategory,
            source: session.source,
            appMinutes: session.appMinutes as unknown as Prisma.InputJsonValue,
          };
          if (consumesOpen && openRow !== null && session === firstClosed) {
            // The open cursor itself settled — flip it closed in place so the
            // (device_id, started_at) unique key is never violated.
            await tx.session.update({
              where: { id: openRow.id },
              data: { ...data, status: 'closed', pending: Prisma.DbNull },
            });
            openRow = null;
          } else {
            await tx.session.upsert({
              where: { deviceId_startedAt: { deviceId, startedAt: session.startedAt } },
              create: { deviceId, ...data, status: 'closed' },
              update: {},
            });
          }
          count += 1;
        }

        // Session closed + XP awarded in one atomic step (design decision):
        // the finalizer's transaction and the gamification side effects share
        // the same transaction, so a crash between them is impossible.
        await this.gamification.syncUser(tx, device.userId, now);
      }

      // Persist/refresh the still-open cursor so a restart never loses the
      // merged snapshot (crash-safety), and it becomes the next tick's anchor.
      // `window` can be non-null both beside newly closed sessions (a fresh
      // trailing window not yet settled) and standalone.
      if (window !== null) {
        const pending = sessionWindowToSnapshot(window);
        if (openRow === null) {
          await createOpenCursor(tx, deviceId, window, pending);
        } else {
          const changed = JSON.stringify(openRow.pending ?? null) !== JSON.stringify(pending);
          if (changed) {
            await tx.session.update({
              where: { id: openRow.id },
              data: {
                startedAt: window.startedAt,
                endedAt: window.endedAt,
                durationMin: Math.max(
                  1,
                  Math.round((window.endedAt.getTime() - window.startedAt.getTime()) / 60000),
                ),
                app: window.events[window.events.length - 1]!.app ?? null,
                windowTitle: window.events[window.events.length - 1]!.windowTitle ?? null,
                category: window.events[window.events.length - 1]!.category ?? 'other',
                subCategory: window.events[window.events.length - 1]!.subCategory ?? null,
                source: window.events[window.events.length - 1]!.source ?? 'x11',
                pending: pending as unknown as Prisma.InputJsonValue,
              },
            });
          }
        }
      }

      return count;
    });

    return { deviceId, closedSessions };
  }

  private async anchor(tx: Prisma.TransactionClient, deviceId: string): Promise<Date> {
    const lastClosed = await tx.session.findFirst({
      where: { deviceId, status: 'closed' },
      orderBy: { endedAt: 'desc' },
      select: { endedAt: true },
    });
    return lastClosed?.endedAt ?? new Date(0);
  }
}

async function createOpenCursor(
  tx: Prisma.TransactionClient,
  deviceId: string,
  window: SessionWindow,
  pending: PendingEventSnapshot[],
): Promise<void> {
  const last = window.events[window.events.length - 1];
  await tx.session.create({
    data: {
      deviceId,
      startedAt: window.startedAt,
      endedAt: window.endedAt,
      durationMin: Math.max(
        1,
        Math.round((window.endedAt.getTime() - window.startedAt.getTime()) / 60000),
      ),
      app: last?.app ?? null,
      windowTitle: last?.windowTitle ?? null,
      category: last?.category ?? 'other',
      subCategory: last?.subCategory ?? null,
      source: last?.source ?? 'x11',
      status: 'open',
      pending: pending as unknown as Prisma.InputJsonValue,
    },
  });
}
