import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { EVENT_SOURCES, EVENT_TYPES, EventSource, EventType } from '@screen-time/core';

export class IngestEventDto {
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Client-reported event time (part of the dedup key)',
  })
  @IsISO8601()
  timestamp!: string;

  @ApiProperty({ enum: EVENT_SOURCES, description: 'Origin of the observation' })
  @IsIn(EVENT_SOURCES as unknown as string[])
  source!: EventSource;

  @ApiProperty({ enum: EVENT_TYPES, description: 'Kind of observation' })
  @IsIn(EVENT_TYPES as unknown as string[])
  eventType!: EventType;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Process/app name (e.g. code, spotify)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  app?: string;

  @ApiPropertyOptional({
    maxLength: 512,
    description: 'Focused window title or page title',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  windowTitle?: string;

  @ApiPropertyOptional({
    maxLength: 2048,
    description: 'Page URL from the browser extension (browse events)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Free-form structured payload (e.g. media track metadata)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
