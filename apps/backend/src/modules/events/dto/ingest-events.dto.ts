import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { IngestEventDto } from './ingest-event.dto';

export class IngestEventsDto {
  @ApiProperty({
    type: [IngestEventDto],
    maxItems: 1000,
    description: 'Batch of raw events to ingest (deduplicated server-side)',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}
