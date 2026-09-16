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

interface CategoryRow {
  category: string;
  minutes: number;
}

interface TrendRow {
  day: string;
  category: string;
  minutes: number;
}

interface AppRow {
  app: string;
  category: string;
  minutes: number;
}

interface FocusEventRow {
  timestamp: Date;
  app: string | null;
  window_title: string | null;
  category: string;
  source: string;
}

function mode<T>(values: (T | null)[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestCount = 0;
  for (const v of values) {
    if (v === null) continue;
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

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

    const [totalRow, categoryRows, sessionCountRow, activeDevicesRow] = await Promise.all([
      this.prisma.$queryRaw<[{ minutes: number }]>`
        SELECT COUNT(DISTINCT date_trunc('minute', re.timestamp))::int AS minutes
        FROM raw_events re
        JOIN devices d ON re.device_id = d.id
        WHERE d.user_id = ${userId}
          AND re.timestamp >= ${dayStart}
          AND re.timestamp < ${dayEnd}
          AND re.event_type = 'focus'
          AND re.category IS NOT NULL
          AND re.category != 'idle_afk'
      `,
      this.prisma.$queryRaw<CategoryRow[]>`
        SELECT re.category,
               COUNT(DISTINCT date_trunc('minute', re.timestamp))::int AS minutes
        FROM raw_events re
        JOIN devices d ON re.device_id = d.id
        WHERE d.user_id = ${userId}
          AND re.timestamp >= ${dayStart}
          AND re.timestamp < ${dayEnd}
          AND re.event_type = 'focus'
          AND re.category IS NOT NULL
          AND re.category != 'idle_afk'
        GROUP BY re.category
      `,
      this.prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT date_trunc('minute', re.timestamp) AS ts,
                 LAG(date_trunc('minute', re.timestamp)) OVER (ORDER BY re.timestamp) AS prev_ts
          FROM raw_events re
          JOIN devices d ON re.device_id = d.id
          WHERE d.user_id = ${userId}
            AND re.timestamp >= ${dayStart}
            AND re.timestamp < ${dayEnd}
            AND re.event_type = 'focus'
            AND re.category != 'idle_afk'
        ) sub
        WHERE prev_ts IS NULL OR ts - prev_ts > INTERVAL '5 minutes'
      `,
      this.prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(DISTINCT re.device_id)::int AS count
        FROM raw_events re
        JOIN devices d ON re.device_id = d.id
        WHERE d.user_id = ${userId}
          AND re.timestamp >= ${dayStart}
          AND re.timestamp < ${dayEnd}
          AND re.event_type = 'focus'
      `,
    ]);

    const totalMinutes = totalRow[0]?.minutes ?? 0;
    const buckets = { focus: 0, autopilot: 0, neutral: 0 };
    for (const row of categoryRows) {
      buckets[bucketFor(row.category)] += row.minutes;
    }

    return {
      date,
      totalMinutes,
      focusMinutes: buckets.focus,
      autopilotMinutes: buckets.autopilot,
      neutralMinutes: buckets.neutral,
      byCategory: categoryRows.map((r) => ({
        category: r.category,
        minutes: r.minutes,
        share: totalMinutes > 0 ? Number((r.minutes / totalMinutes).toFixed(4)) : 0,
      })),
      sessionCount: sessionCountRow[0]?.count ?? 0,
      activeDevices: activeDevicesRow[0]?.count ?? 0,
    };
  }

  async getTrends(userId: string, range: string, tz: string) {
    const days = RANGE_DAYS[range] ?? 7;
    const rangeStart = await this.prisma.$queryRaw<[{ start: Date }]>`
      SELECT (NOW() AT TIME ZONE ${tz} - ${days}::int * INTERVAL '1 day')::timestamptz AS start
    `;
    const from = rangeStart[0].start;
    const to = await this.prisma.$queryRaw<[{ now: Date }]>`
      SELECT (NOW() AT TIME ZONE ${tz})::timestamptz AS now
    `;
    const end = to[0].now;

    const rows = await this.prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc('day', re.timestamp AT TIME ZONE ${tz})::date::text AS day,
             re.category,
             COUNT(DISTINCT date_trunc('minute', re.timestamp))::int AS minutes
      FROM raw_events re
      JOIN devices d ON re.device_id = d.id
      WHERE d.user_id = ${userId}
        AND re.timestamp >= ${from}
        AND re.timestamp < ${end}
        AND re.event_type = 'focus'
        AND re.category IS NOT NULL
        AND re.category != 'idle_afk'
      GROUP BY day, re.category
      ORDER BY day
    `;

    const byDay = new Map<
      string,
      { totalMinutes: number; byCategory: { category: string; minutes: number }[] }
    >();
    for (const r of rows) {
      let bucket = byDay.get(r.day);
      if (!bucket) {
        bucket = { totalMinutes: 0, byCategory: [] };
        byDay.set(r.day, bucket);
      }
      bucket.totalMinutes += r.minutes;
      bucket.byCategory.push({ category: r.category, minutes: r.minutes });
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

    const [categoryRows, appRows] = await Promise.all([
      this.prisma.$queryRaw<CategoryRow[]>`
        SELECT re.category,
               COUNT(DISTINCT date_trunc('minute', re.timestamp))::int AS minutes
        FROM raw_events re
        JOIN devices d ON re.device_id = d.id
        WHERE d.user_id = ${userId}
          AND re.timestamp >= ${from}
          AND re.timestamp < ${end}
          AND re.event_type = 'focus'
          AND re.category IS NOT NULL
          AND re.category != 'idle_afk'
        GROUP BY re.category
        ORDER BY minutes DESC
      `,
      this.prisma.$queryRaw<AppRow[]>`
        SELECT re.app, re.category,
               COUNT(DISTINCT date_trunc('minute', re.timestamp))::int AS minutes
        FROM raw_events re
        JOIN devices d ON re.device_id = d.id
        WHERE d.user_id = ${userId}
          AND re.timestamp >= ${from}
          AND re.timestamp < ${end}
          AND re.event_type = 'focus'
          AND re.app IS NOT NULL
          AND re.category IS NOT NULL
          AND re.category != 'idle_afk'
        GROUP BY re.app, re.category
      `,
    ]);

    const totalMinutes = categoryRows.reduce((sum, r) => sum + r.minutes, 0);
    const appsByCategory = new Map<string, { app: string; minutes: number }[]>();
    for (const r of appRows) {
      const list = appsByCategory.get(r.category) ?? [];
      list.push({ app: r.app, minutes: r.minutes });
      appsByCategory.set(r.category, list);
    }
    for (const list of appsByCategory.values()) {
      list.sort((a, b) => b.minutes - a.minutes);
      list.splice(5);
    }

    return {
      range,
      totals: categoryRows.map((r) => ({
        category: r.category,
        minutes: r.minutes,
        share: totalMinutes > 0 ? Number((r.minutes / totalMinutes).toFixed(4)) : 0,
        topApps: appsByCategory.get(r.category) ?? [],
      })),
    };
  }

  async getSessions(userId: string, from: string, to: string) {
    const events = await this.prisma.$queryRaw<FocusEventRow[]>`
      SELECT re.timestamp, re.app, re.window_title, re.category, re.source
      FROM raw_events re
      JOIN devices d ON re.device_id = d.id
      WHERE d.user_id = ${userId}
        AND re.timestamp >= ${new Date(from)}
        AND re.timestamp < ${new Date(to)}
        AND re.event_type = 'focus'
        AND re.category IS NOT NULL
        AND re.category != 'idle_afk'
      ORDER BY re.timestamp ASC
    `;

    const GAP_MS = 5 * 60 * 1000;
    const sessions: {
      startedAt: Date;
      endedAt: Date;
      durationMin: number;
      app: string | null;
      windowTitle: string | null;
      category: string;
      source: string;
    }[] = [];

    if (events.length === 0) return sessions;

    let current: { start: FocusEventRow; end: FocusEventRow; batch: FocusEventRow[] } | null = null;
    for (const event of events) {
      if (current === null) {
        current = { start: event, end: event, batch: [event] };
        continue;
      }
      const gap = event.timestamp.getTime() - current.end.timestamp.getTime();
      if (gap > GAP_MS) {
        sessions.push(finalizeSession(current.batch));
        current = { start: event, end: event, batch: [event] };
      } else {
        current.end = event;
        current.batch.push(event);
      }
    }
    if (current) {
      sessions.push(finalizeSession(current.batch));
    }
    return sessions;
  }
}

function finalizeSession(batch: FocusEventRow[]) {
  const first = batch[0] ?? batch[1];
  const last = batch[batch.length - 1];
  if (!first || !last) {
    throw new Error('finalizeSession called with an empty batch');
  }
  return {
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    durationMin: Math.max(
      1,
      Math.round((last.timestamp.getTime() - first.timestamp.getTime()) / 60000),
    ),
    app: mode(batch.map((e) => e.app)),
    windowTitle: mode(batch.map((e) => e.window_title)),
    category: mode(batch.map((e) => e.category)) ?? 'other',
    source: mode(batch.map((e) => e.source)) ?? 'x11',
  };
}
