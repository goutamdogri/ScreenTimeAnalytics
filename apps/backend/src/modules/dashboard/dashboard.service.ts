import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RANGE_DAYS: Record<string, number> = { week: 7, month: 30, quarter: 90 };

const FOCUS_CATEGORIES = ['deep_work', 'learning', 'browsing_research'] as const;
const AUTOPILOT_CATEGORIES = ['social_media', 'short_form_video', 'long_form_video'] as const;

function bucketFor(category: string): 'focus' | 'autopilot' | 'neutral' {
  if ((FOCUS_CATEGORIES as readonly string[]).includes(category)) return 'focus';
  if ((AUTOPILOT_CATEGORIES as readonly string[]).includes(category)) return 'autopilot';
  return 'neutral';
}

/**
 * Dashboard reads — all sourced from the **closed `sessions` table**, never
 * raw_events (design doc §6, Phase 5 decision: sessions are the single source
 * of truth shared by the dashboard and the gamification engine, so the two can
 * never disagree). Sessions are finalized by `SessionFinalizerWorker` within
 * `settleMs`; closed rows are immutable.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, date: string, tz: string) {
    const [bounds] = await this.prisma.$queryRaw<[{ start: Date; end: Date }]>`
      SELECT (${date}::timestamp AT TIME ZONE ${tz})::timestamptz AS start,
             (${date}::timestamp AT TIME ZONE ${tz})::timestamptz + INTERVAL '1 day' AS end
    `;
    const dayStart = bounds.start;
    const dayEnd = bounds.end;

    const sessions = await this.prisma.session.findMany({
      where: {
        device: { userId },
        status: 'closed',
        startedAt: { gte: dayStart, lt: dayEnd },
      },
      select: { durationMin: true, category: true, deviceId: true },
    });

    const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
    const buckets = { focus: 0, autopilot: 0, neutral: 0 };
    const byCategoryMap = new Map<string, number>();
    for (const s of sessions) {
      buckets[bucketFor(s.category)] += s.durationMin;
      byCategoryMap.set(s.category, (byCategoryMap.get(s.category) ?? 0) + s.durationMin);
    }

    return {
      date,
      totalMinutes,
      focusMinutes: buckets.focus,
      autopilotMinutes: buckets.autopilot,
      neutralMinutes: buckets.neutral,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, minutes]) => ({
        category,
        minutes,
        share: totalMinutes > 0 ? Number((minutes / totalMinutes).toFixed(4)) : 0,
      })),
      sessionCount: sessions.length,
      activeDevices: new Set(sessions.map((s) => s.deviceId)).size,
    };
  }

  async getTrends(userId: string, range: string, tz: string) {
    const days = RANGE_DAYS[range] ?? 7;
    const [fromRow, toRow] = await Promise.all([
      this.prisma.$queryRaw<[{ start: Date }]>`
        SELECT (NOW() AT TIME ZONE ${tz} - ${days}::int * INTERVAL '1 day')::timestamptz AS start
      `,
      this.prisma.$queryRaw<[{ now: Date }]>`
        SELECT (NOW() AT TIME ZONE ${tz})::timestamptz AS now
      `,
    ]);
    const from = fromRow[0].start;
    const end = toRow[0].now;

    const sessions = await this.prisma.session.findMany({
      where: {
        device: { userId },
        status: 'closed',
        startedAt: { gte: from, lt: end },
      },
      select: { startedAt: true, durationMin: true, category: true },
    });

    const byDay = new Map<
      string,
      { totalMinutes: number; byCategory: { category: string; minutes: number }[] }
    >();
    for (const s of sessions) {
      const day = s.startedAt.toISOString().slice(0, 10);
      let bucket = byDay.get(day);
      if (!bucket) {
        bucket = { totalMinutes: 0, byCategory: [] };
        byDay.set(day, bucket);
      }
      bucket.totalMinutes += s.durationMin;
      const existing = bucket.byCategory.find((c) => c.category === s.category);
      if (existing) {
        existing.minutes += s.durationMin;
      } else {
        bucket.byCategory.push({ category: s.category, minutes: s.durationMin });
      }
    }

    return {
      range,
      days: Array.from(byDay.entries()).map(([date, data]) => ({
        date,
        ...data,
      })),
    };
  }

  async getCategories(userId: string, range: string, tz: string) {
    const days = RANGE_DAYS[range] ?? 7;
    const [fromRow, toRow] = await Promise.all([
      this.prisma.$queryRaw<[{ start: Date }]>`
        SELECT (NOW() AT TIME ZONE ${tz} - ${days}::int * INTERVAL '1 day')::timestamptz AS start
      `,
      this.prisma.$queryRaw<[{ now: Date }]>`
        SELECT (NOW() AT TIME ZONE ${tz})::timestamptz AS now
      `,
    ]);
    const from = fromRow[0].start;
    const end = toRow[0].now;

    const sessions = await this.prisma.session.findMany({
      where: {
        device: { userId },
        status: 'closed',
        startedAt: { gte: from, lt: end },
      },
      select: { durationMin: true, category: true, appMinutes: true, app: true },
    });

    const categoryMap = new Map<string, number>();
    const appsByCategory = new Map<string, Map<string, number>>();
    for (const s of sessions) {
      categoryMap.set(s.category, (categoryMap.get(s.category) ?? 0) + s.durationMin);
      const perCategory = appsByCategory.get(s.category) ?? new Map<string, number>();
      appsByCategory.set(s.category, perCategory);
      if (typeof s.appMinutes === 'object' && s.appMinutes !== null) {
        for (const [app, minutes] of Object.entries(s.appMinutes)) {
          perCategory.set(app, (perCategory.get(app) ?? 0) + (Number(minutes) || 0));
        }
      } else if (s.app) {
        perCategory.set(s.app, (perCategory.get(s.app) ?? 0) + s.durationMin);
      }
    }

    const totalMinutes = Array.from(categoryMap.values()).reduce((sum, m) => sum + m, 0);
    const totals = Array.from(categoryMap.entries())
      .map(([category, minutes]) => {
        const top = Array.from((appsByCategory.get(category) ?? new Map()).entries())
          .map(([app, appMinutes]) => ({ app, minutes: appMinutes }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 5);
        return {
          category,
          minutes,
          share: totalMinutes > 0 ? Number((minutes / totalMinutes).toFixed(4)) : 0,
          topApps: top,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return { range, totals };
  }

  async getSessions(userId: string, from: string, to: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        device: { userId },
        status: 'closed',
        startedAt: { gte: new Date(from), lt: new Date(to) },
      },
      orderBy: { startedAt: 'asc' },
      select: {
        startedAt: true,
        endedAt: true,
        durationMin: true,
        app: true,
        windowTitle: true,
        category: true,
        source: true,
      },
    });

    return sessions.map((s) => ({
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMin: s.durationMin,
      app: s.app,
      windowTitle: s.windowTitle,
      category: s.category,
      source: s.source,
    }));
  }
}
