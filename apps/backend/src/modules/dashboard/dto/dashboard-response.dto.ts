import { ApiProperty } from '@nestjs/swagger';

export class CategoryMinuteDto {
  @ApiProperty({ example: 'deep_work' })
  category!: string;

  @ApiProperty({ example: 120 })
  minutes!: number;

  @ApiProperty({ example: 0.45 })
  share!: number;
}

export class DashboardSummaryResponse {
  @ApiProperty({ example: '2026-09-16' })
  date!: string;

  @ApiProperty({ example: 268 })
  totalMinutes!: number;

  @ApiProperty({ example: 142 })
  focusMinutes!: number;

  @ApiProperty({ example: 86 })
  autopilotMinutes!: number;

  @ApiProperty({ example: 40 })
  neutralMinutes!: number;

  @ApiProperty({ type: [CategoryMinuteDto] })
  byCategory!: CategoryMinuteDto[];

  @ApiProperty({ example: 12 })
  sessionCount!: number;

  @ApiProperty({ example: 2 })
  activeDevices!: number;
}

export class TrendDayCategoryDto {
  @ApiProperty({ example: 'deep_work' })
  category!: string;

  @ApiProperty({ example: 90 })
  minutes!: number;
}

export class TrendDayDto {
  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiProperty({ example: 310 })
  totalMinutes!: number;

  @ApiProperty({ type: [TrendDayCategoryDto] })
  byCategory!: TrendDayCategoryDto[];
}

export class DashboardTrendsResponse {
  @ApiProperty({ enum: ['week', 'month', 'quarter'] })
  range!: 'week' | 'month' | 'quarter';

  @ApiProperty({ type: [TrendDayDto] })
  days!: TrendDayDto[];
}

export class TopAppDto {
  @ApiProperty({ example: 'code' })
  app!: string;

  @ApiProperty({ example: 145 })
  minutes!: number;
}

export class CategoryTotalDto {
  @ApiProperty({ example: 'deep_work' })
  category!: string;

  @ApiProperty({ example: 420 })
  minutes!: number;

  @ApiProperty({ example: 0.38 })
  share!: number;

  @ApiProperty({ type: [TopAppDto] })
  topApps!: TopAppDto[];
}

export class DashboardCategoriesResponse {
  @ApiProperty({ enum: ['week', 'month', 'quarter'] })
  range!: 'week' | 'month' | 'quarter';

  @ApiProperty({ type: [CategoryTotalDto] })
  totals!: CategoryTotalDto[];
}

export class SessionDto {
  @ApiProperty({ example: '2026-09-16T10:05:00.000Z' })
  startedAt!: string;

  @ApiProperty({ example: '2026-09-16T10:32:00.000Z' })
  endedAt!: string;

  @ApiProperty({ example: 27 })
  durationMin!: number;

  @ApiProperty({ example: 'code' })
  app!: string | null;

  @ApiProperty({ example: 'schema.prisma' })
  windowTitle!: string | null;

  @ApiProperty({ example: 'deep_work' })
  category!: string;

  @ApiProperty({ example: 'x11' })
  source!: string;
}

export class DashboardSessionsResponse {
  @ApiProperty({ type: [SessionDto] })
  sessions!: SessionDto[];
}
