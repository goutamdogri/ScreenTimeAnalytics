import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class DashboardSummaryDto {
  @ApiPropertyOptional({
    description: 'Date in YYYY-MM-DD format (default: today UTC)',
    example: '2026-09-16',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ description: 'IANA timezone (default: UTC)', example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  tz?: string;
}

export class DashboardRangeDto {
  @ApiPropertyOptional({ enum: ['week', 'month', 'quarter'], default: 'week' })
  @IsOptional()
  @IsIn(['week', 'month', 'quarter'])
  range?: 'week' | 'month' | 'quarter';

  @ApiPropertyOptional({ description: 'IANA timezone (default: UTC)', example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  tz?: string;
}

export class DashboardSessionsDto {
  @ApiPropertyOptional({ description: 'ISO-8601 start (default: 7 days ago)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 end (default: now)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'IANA timezone (default: UTC)', example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  tz?: string;
}
