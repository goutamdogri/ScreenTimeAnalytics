import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GamificationStatsDto {
  @ApiProperty({ example: 420 })
  focus!: number;

  @ApiProperty({ example: 180 })
  wisdom!: number;

  @ApiProperty({ example: 70 })
  discipline!: number;

  @ApiProperty({ example: 50 })
  restraint!: number;
}

export class GamificationStateResponse {
  @ApiProperty({ example: 4 })
  level!: number;

  @ApiProperty({ example: 320 })
  xp!: number;

  @ApiProperty({ example: 220 })
  inLevel!: number;

  @ApiProperty({ example: 283 })
  forNextLevel!: number;

  @ApiProperty({ example: 0.78 })
  progress!: number;

  @ApiProperty({ example: 9 })
  coins!: number;

  @ApiProperty({ example: 3 })
  streakDays!: number;

  @ApiProperty({ type: GamificationStatsDto })
  stats!: GamificationStatsDto;
}

export class DailyQuestDto {
  @ApiProperty({ example: 'deep_work_target' })
  key!: string;

  @ApiProperty({ example: 'Deep work target' })
  title!: string;

  @ApiProperty({ example: 'Reach 40 minutes of deep work today' })
  description!: string;

  @ApiProperty({ example: 25 })
  progress!: number;

  @ApiProperty({ example: 40 })
  target!: number;

  @ApiProperty({ example: 40 })
  rewardXp!: number;

  @ApiProperty({ example: false })
  completed!: boolean;

  @ApiPropertyOptional({ example: '2026-09-17T12:00:00.000Z', type: String, nullable: true })
  completedAt!: string | null;
}

export class WeeklyBossDto {
  @ApiProperty({ example: 'weekly_boss' })
  key!: string;

  @ApiProperty({ example: 'Weekly boss' })
  title!: string;

  @ApiProperty({ example: "Defeat this week's focus boss (180 minutes of deep work)" })
  description!: string;

  @ApiProperty({ example: '2026-09-14T00:00:00.000Z' })
  periodStart!: string;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z' })
  periodEnd!: string;

  @ApiProperty({ example: 180 })
  target!: number;

  @ApiProperty({ example: 62 })
  focusMinutes!: number;

  @ApiProperty({ example: 66 })
  hp!: number;

  @ApiProperty({ example: 200 })
  rewardXp!: number;

  @ApiProperty({ example: false })
  defeated!: boolean;

  @ApiProperty({ example: false })
  completed!: boolean;
}

export class GamificationQuestsResponse {
  @ApiProperty({ example: '2026-09-17' })
  date!: string;

  @ApiProperty({ type: [DailyQuestDto] })
  dailyQuests!: DailyQuestDto[];

  @ApiProperty({ type: WeeklyBossDto })
  weeklyBoss!: WeeklyBossDto;
}

export class AchievementDto {
  @ApiProperty({ example: 'first_deep_work' })
  key!: string;

  @ApiProperty({ example: 'First deep block' })
  title!: string;

  @ApiProperty({ example: 'Complete one 20-minute deep-work session' })
  description!: string;

  @ApiProperty({ example: '2026-09-16T09:00:00.000Z' })
  unlockedAt!: string;
}

export class GamificationAchievementsResponse {
  @ApiProperty({ type: [AchievementDto] })
  achievements!: AchievementDto[];
}

export class LeaderboardEntryDto {
  @ApiProperty({ example: '2026-09-07' })
  date!: string;

  @ApiProperty({ example: 205 })
  focusMinutes!: number;
}

export class FocusMinutesDto {
  @ApiProperty({ example: 62 })
  focusMinutes!: number;
}

export class GamificationLeaderboardResponse {
  @ApiPropertyOptional({ type: LeaderboardEntryDto, nullable: true })
  weeklyBest!: LeaderboardEntryDto | null;

  @ApiPropertyOptional({ type: LeaderboardEntryDto, nullable: true })
  monthlyBest!: LeaderboardEntryDto | null;

  @ApiProperty({ type: FocusMinutesDto })
  currentWeek!: FocusMinutesDto;

  @ApiProperty({ type: FocusMinutesDto })
  currentMonth!: FocusMinutesDto;
}
