import { Injectable } from '@nestjs/common';
import { Prisma } from '@screen-time/db';
import {
  AchievementContext,
  bossProgress,
  Category,
  currentStreak,
  dailyQuestKey,
  dayKey,
  dayStatsByDay,
  DailyHistory,
  DEEP_WORK_MIN_MINUTES,
  evaluateDailyQuest,
  generateDailyQuests,
  lifetimeStats,
  statForCategory,
  streakMultiplier,
  streakOnDay,
  totalCoinsForLevel,
  unlockedAchievements,
  weeklyBossTarget,
  WEEKLY_BOSS_REWARD_XP,
  baseXpForSession,
  xpForClose,
  xpProgress,
} from '@screen-time/core';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEKLY_BOSS_QUEST_KEY = 'weekly_boss';
const DEEP_WORK_BLOCK_MIN = 25;

/** A session plus its pre-computed (idempotent) XP award. */
interface SessionAward {
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  category: string;
  stat: 'focus' | 'wisdom' | null;
  xp: number;
}

interface Aggregated {
  userId: string;
  now: Date;
  today: string;
  sessions: SessionAward[];
  streakDays: number;
  lifetime: ReturnType<typeof lifetimeStats>;
  deepWorkSessions: number;
  totalXp: number;
  history: DailyHistory;
}

export interface SyncSummary {
  sessionsAwarded: number;
  questsRewarded: number;
  bossRewarded: number;
  achievementsUnlocked: number;
}

/**
 * XP / stat / quest engine (design doc §4), the only place any gamification
 * value is written to the database.
 *
 * `syncUser` is a full, idempotent reconciliation for one user inside a caller
 * transaction: session XP, daily quests, the weekly boss, achievements, and the
 * `user_state` cache. Every award is keyed by a unique `(source, source_ref)`
 * in `xp_log`, so re-running a tick (crash, backoff retry) is a no-op — never
 * a double-award (design doc §8.4). Once a session closes, the session row is
 * immutable, so "session written before a later LLM recategorization" cannot
 * retroactively change the XP that was awarded at close.
 *
 * Read endpoints recompute the four stats and live quest progress straight from
 * `sessions` (single source of truth); `user_state` is only the cached
 * xp/level/coins/streak baseline.
 */
@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full per-user gamification reconciliation. All reads and writes happen
   * against `tx`, so a finalizer can close a session and award its XP in one
   * atomic step (design decision: "a session closed → write the session, then
   * award its XP").
   */
  async syncUser(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ): Promise<SyncSummary> {
    const agg = await this.aggregate(tx, userId, now);
    const todayStart = startOfDay(now);

    // Sessions → XP (design doc §4.2). Awarded at close; the `session:<id>`
    // source_ref keeps it a one-time payment even across worker restarts.
    const sessionRows = agg.sessions
      .filter((s) => s.xp > 0)
      .map((s) => ({
        userId,
        timestamp: s.endedAt,
        amount: s.xp,
        source: 'session',
        statAffected: s.stat,
        sourceRef: `session:${s.id}`,
      }));
    const sessionsAwarded = sessionRows.length
      ? (await tx.xpLog.createMany({ data: sessionRows, skipDuplicates: true })).count
      : 0;

    // Stale dailies (previous days) are hygiene-expired, never deleted.
    await tx.quest.updateMany({
      where: { userId, type: 'daily', status: 'active', periodStart: { lt: todayStart } },
      data: { status: 'expired' },
    });

    let questsRewarded = 0;
    let bossRewarded = 0;
    for (const template of generateDailyQuests(agg.history)) {
      const key = dailyQuestKey(template.key, agg.today);
      const evaluation = evaluateDailyQuest(template, agg.history);
      const row = await tx.quest.upsert({
        where: { userId_key_periodStart: { userId, key, periodStart: todayStart } },
        create: {
          userId,
          type: 'daily',
          key,
          title: template.title,
          description: template.description,
          criteria: evaluation as unknown as Prisma.InputJsonValue,
          status: 'active',
          progress: evaluation as unknown as Prisma.InputJsonValue,
          rewardXp: template.rewardXp,
          periodStart: todayStart,
          periodEnd: new Date(todayStart.getTime() + DAY_MS),
        },
        update: {
          title: template.title,
          description: template.description,
          criteria: evaluation as unknown as Prisma.InputJsonValue,
          progress: evaluation as unknown as Prisma.InputJsonValue,
        },
      });
      if (evaluation.completed && row.status === 'active') {
        await tx.quest.update({
          where: { id: row.id },
          data: {
            status: 'completed',
            completedAt: now,
            rewardGiven: true,
            progress: evaluation as unknown as Prisma.InputJsonValue,
          },
        });
        if (
          (
            await tx.xpLog.createMany({
              data: [
                {
                  userId,
                  timestamp: now,
                  amount: evaluation.rewardXp,
                  source: 'quest',
                  statAffected: null,
                  sourceRef: `quest:${key}`,
                },
              ],
              skipDuplicates: true,
            })
          ).count > 0
        ) {
          questsRewarded += 1;
        }
      }
    }

    const weekStart = startOfWeek(now);
    const thisWeekFocus = this.focusInPeriod(
      agg.sessions,
      weekStart,
      new Date(weekStart.getTime() + WEEK_MS),
    );
    const target = weeklyBossTarget(this.priorWeeksFocusMinutes(agg.sessions, now, weekStart));
    const boss = bossProgress(thisWeekFocus, target);
    const bossRow = await tx.quest.upsert({
      where: {
        userId_key_periodStart: { userId, key: WEEKLY_BOSS_QUEST_KEY, periodStart: weekStart },
      },
      create: {
        userId,
        type: 'weekly',
        key: WEEKLY_BOSS_QUEST_KEY,
        title: 'Weekly boss',
        description: this.bossDescription(target),
        criteria: boss as unknown as Prisma.InputJsonValue,
        status: 'active',
        progress: boss as unknown as Prisma.InputJsonValue,
        rewardXp: WEEKLY_BOSS_REWARD_XP,
        periodStart: weekStart,
        periodEnd: new Date(weekStart.getTime() + WEEK_MS),
      },
      update: {
        title: 'Weekly boss',
        description: this.bossDescription(target),
        criteria: boss as unknown as Prisma.InputJsonValue,
        progress: boss as unknown as Prisma.InputJsonValue,
      },
    });
    if (boss.defeated && bossRow.status === 'active') {
      await tx.quest.update({
        where: { id: bossRow.id },
        data: {
          status: 'completed',
          completedAt: now,
          rewardGiven: true,
          progress: boss as unknown as Prisma.InputJsonValue,
        },
      });
      if (
        (
          await tx.xpLog.createMany({
            data: [
              {
                userId,
                timestamp: now,
                amount: WEEKLY_BOSS_REWARD_XP,
                source: 'quest',
                statAffected: null,
                sourceRef: `quest:weekly_boss:${dayKey(weekStart)}`,
              },
            ],
            skipDuplicates: true,
          })
        ).count > 0
      ) {
        bossRewarded += 1;
      }
    }

    let achievementsUnlocked = 0;
    const freshTotal =
      (await tx.xpLog.aggregate({ where: { userId }, _sum: { amount: true } }))._sum?.amount ?? 0;
    const levelInfo = xpProgress(freshTotal);
    const ctx: AchievementContext = {
      level: levelInfo.level,
      streakDays: agg.streakDays,
      focusMinutes: agg.lifetime.focus,
      wisdomMinutes: agg.lifetime.wisdom,
      deepWorkSessions: agg.deepWorkSessions,
    };
    const unlocked = unlockedAchievements(ctx);
    if (unlocked.length > 0) {
      const existing = await tx.achievement.findMany({ where: { userId }, select: { key: true } });
      const existingKeys = new Set(existing.map((a) => a.key));
      for (const achievement of unlocked) {
        if (existingKeys.has(achievement.key)) continue;
        await tx.achievement.createMany({
          data: [
            {
              userId,
              key: achievement.key,
              title: achievement.title,
              description: achievement.description,
              unlockedAt: now,
            },
          ],
          skipDuplicates: true,
        });
        if (
          (
            await tx.xpLog.createMany({
              data: [
                {
                  userId,
                  timestamp: now,
                  amount: achievement.rewardXp,
                  source: 'achievement',
                  statAffected: null,
                  sourceRef: `achievement:${achievement.key}`,
                },
              ],
              skipDuplicates: true,
            })
          ).count > 0
        ) {
          achievementsUnlocked += 1;
        }
      }
    }

    // `user_state` is a pure cache of `xp_log` + streak, recomputed last so the
    // user_state level always lags nothing and only ever advances.
    await tx.userState.upsert({
      where: { userId },
      create: {
        userId,
        xp: freshTotal,
        level: levelInfo.level,
        coins: totalCoinsForLevel(levelInfo.level),
        streakCount: agg.streakDays,
      },
      update: {
        xp: freshTotal,
        level: levelInfo.level,
        coins: totalCoinsForLevel(levelInfo.level),
        streakCount: agg.streakDays,
      },
    });

    return { sessionsAwarded, questsRewarded, bossRewarded, achievementsUnlocked };
  }

  async getState(userId: string): Promise<unknown> {
    const agg = await this.aggregate(this.prisma, userId, new Date());
    const progress = xpProgress(agg.totalXp);
    return {
      level: progress.level,
      xp: progress.xp,
      inLevel: progress.inLevel,
      forNextLevel: progress.forNextLevel,
      progress: progress.progress,
      coins: totalCoinsForLevel(progress.level),
      streakDays: agg.streakDays,
      stats: agg.lifetime,
    };
  }

  async getQuests(userId: string): Promise<unknown> {
    const now = new Date();
    const agg = await this.aggregate(this.prisma, userId, now);
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);

    const [dailyRows, bossRow] = await Promise.all([
      this.prisma.quest.findMany({
        where: { userId, type: 'daily', periodStart: todayStart },
      }),
      this.prisma.quest.findFirst({ where: { userId, type: 'weekly', periodStart: weekStart } }),
    ]);

    const dailyQuests = generateDailyQuests(agg.history).map((template) => {
      const evaluation = evaluateDailyQuest(template, agg.history);
      const row = dailyRows.find((r) => r.key === dailyQuestKey(template.key, agg.today));
      return {
        key: template.key,
        title: template.title,
        description: template.description,
        progress: evaluation.progress,
        target: evaluation.target,
        rewardXp: template.rewardXp,
        completed: row?.status === 'completed' || evaluation.completed,
        completedAt: row?.completedAt ?? null,
      };
    });

    const thisWeekFocus = this.focusInPeriod(
      agg.sessions,
      weekStart,
      new Date(weekStart.getTime() + WEEK_MS),
    );
    const boss = bossProgress(
      thisWeekFocus,
      weeklyBossTarget(this.priorWeeksFocusMinutes(agg.sessions, now, weekStart)),
    );

    return {
      date: agg.today,
      dailyQuests,
      weeklyBoss: {
        key: WEEKLY_BOSS_QUEST_KEY,
        title: 'Weekly boss',
        description: this.bossDescription(boss.target),
        periodStart: weekStart.toISOString(),
        periodEnd: new Date(weekStart.getTime() + WEEK_MS).toISOString(),
        target: boss.target,
        focusMinutes: boss.focusMinutes,
        hp: boss.hp,
        rewardXp: bossRow?.rewardXp ?? WEEKLY_BOSS_REWARD_XP,
        defeated: boss.defeated,
        completed: bossRow?.status === 'completed',
      },
    };
  }

  async getAchievements(userId: string): Promise<unknown> {
    const rows = await this.prisma.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' },
      select: { key: true, title: true, description: true, unlockedAt: true },
    });
    return { achievements: rows };
  }

  async getLeaderboard(userId: string): Promise<unknown> {
    const sessions = await this.prisma.session.findMany({
      where: { device: { userId }, status: 'closed' },
      select: { startedAt: true, durationMin: true, category: true },
    });
    const now = new Date();
    const weekStart = startOfWeek(now);

    const weekly = new Map<string, number>();
    const monthly = new Map<string, number>();
    let currentWeek = 0;
    let currentMonth = 0;
    for (const s of sessions) {
      if (s.category !== Category.DEEP_WORK) continue;
      const ws = startOfWeek(s.startedAt);
      const ms = `${s.startedAt.getUTCFullYear()}-${String(s.startedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      if (ws.getTime() >= weekStart.getTime()) {
        currentWeek += s.durationMin;
      } else if (ws.getTime() + WEEK_MS <= now.getTime()) {
        weekly.set(dayKey(ws), (weekly.get(dayKey(ws)) ?? 0) + s.durationMin);
      }
      if (ms === monthKey(now)) {
        currentMonth += s.durationMin;
      } else {
        monthly.set(ms, (monthly.get(ms) ?? 0) + s.durationMin);
      }
    }

    return {
      weeklyBest: bestEntry(weekly),
      monthlyBest: bestEntry(monthly),
      currentWeek: { focusMinutes: currentWeek },
      currentMonth: { focusMinutes: currentMonth },
    };
  }

  /** Pure aggregation shared by sync and all read endpoints. */
  private async aggregate(
    client: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<Aggregated> {
    const sessions = await client.session.findMany({
      where: { device: { userId }, status: 'closed' },
      select: { id: true, startedAt: true, endedAt: true, durationMin: true, category: true },
    });

    const byDay = dayStatsByDay(sessions);
    const days = [...byDay.values()].map((d) => ({ date: d.date, activeDay: d.activeDay }));
    const streakDays = currentStreak(days, now);
    const lifetime = lifetimeStats(sessions);
    const deepWorkSessions = sessions.filter(
      (s) => s.category === Category.DEEP_WORK && s.durationMin >= DEEP_WORK_MIN_MINUTES,
    ).length;
    const totalXp =
      (await client.xpLog.aggregate({ where: { userId }, _sum: { amount: true } }))._sum?.amount ??
      0;

    const awards: SessionAward[] = sessions.map((s) => {
      const stat = statForCategory(s.category);
      const base = stat ? baseXpForSession(s) : 0;
      const multiplier = stat ? streakMultiplier(streakOnDay(days, dayKey(s.startedAt))) : 1;
      return {
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMin: s.durationMin,
        category: s.category,
        stat,
        xp: base > 0 ? xpForClose(base, multiplier) : 0,
      };
    });

    const today = dayKey(now);
    const todayStats = byDay.get(today);
    const todaySessions = awards.filter((s) => dayKey(s.startedAt) === today);
    const todayShortFormMinutes = todaySessions
      .filter((s) => s.category === Category.SHORT_FORM_VIDEO)
      .reduce((sum, s) => sum + s.durationMin, 0);
    const todayDeepWorkBlockCount = todaySessions.filter(
      (s) => s.category === Category.DEEP_WORK && s.durationMin >= DEEP_WORK_BLOCK_MIN,
    ).length;

    let rollingDeepWork = 0;
    let cursor = today;
    for (let i = 0; i < 7; i += 1) {
      cursor = dayBeforeKey(cursor);
      rollingDeepWork += byDay.get(cursor)?.deepWorkMinutes ?? 0;
    }
    const history: DailyHistory = {
      averageDeepWorkMinutes: rollingDeepWork / 7,
      yesterdayTotalMinutes: byDay.get(dayBeforeKey(today))?.totalMinutes ?? null,
      todayTotalMinutes: todayStats?.totalMinutes ?? 0,
      todayDeepWorkMinutes: todayStats?.deepWorkMinutes ?? 0,
      todayShortFormMinutes,
      todayDeepWorkBlockCount,
    };

    return {
      userId,
      now,
      today,
      sessions: awards,
      streakDays,
      lifetime,
      deepWorkSessions,
      totalXp,
      history,
    };
  }

  /** Focus minutes in `[from, to)`, i.e. the boss fight's damage so far. */
  private focusInPeriod(sessions: SessionAward[], from: Date, to: Date): number {
    return sessions
      .filter(
        (s) =>
          s.category === Category.DEEP_WORK &&
          s.startedAt.getTime() >= from.getTime() &&
          s.startedAt.getTime() < to.getTime(),
      )
      .reduce((sum, s) => sum + s.durationMin, 0);
  }

  /** Deep-work minutes of complete prior weeks (up to 4, most recent first). */
  private priorWeeksFocusMinutes(
    sessions: SessionAward[],
    now: Date,
    currentWeekStart: Date,
  ): number[] {
    const buckets = new Map<string, number>();
    for (const s of sessions) {
      if (s.category !== Category.DEEP_WORK) continue;
      const ws = startOfWeek(s.startedAt);
      if (ws.getTime() >= currentWeekStart.getTime()) continue;
      if (ws.getTime() + WEEK_MS > now.getTime()) continue;
      const key = dayKey(ws);
      buckets.set(key, (buckets.get(key) ?? 0) + s.durationMin);
    }
    const totals = [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, m]) => m);
    return totals.slice(0, 4);
  }

  private bossDescription(target: number): string {
    return `Defeat this week's focus boss (${target} minutes of deep work)`;
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const dayOfWeek = (day.getUTCDay() + 6) % 7; // 0 = Monday
  day.setUTCDate(day.getUTCDate() - dayOfWeek);
  return day;
}

function dayBeforeKey(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKey(d);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function bestEntry(map: Map<string, number>): { date: string; focusMinutes: number } | null {
  let best: { date: string; focusMinutes: number } | null = null;
  for (const [date, minutes] of map) {
    if (best === null || minutes > best.focusMinutes) {
      best = { date, focusMinutes: minutes };
    }
  }
  return best;
}
