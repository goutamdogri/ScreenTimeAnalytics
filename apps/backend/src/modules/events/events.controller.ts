import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentDevice } from '../devices/current-device.decorator';
import { AuthenticatedDevice } from '../devices/guards/device-token.guard';
import { DeviceTokenGuard } from '../devices/guards/device-token.guard';
import { IngestEventsDto } from './dto/ingest-events.dto';
import { EventsService, IngestResult } from './events.service';

@ApiTags('events')
@UseGuards(DeviceTokenGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingest a batch of raw events (authenticated with the opaque device token)',
  })
  @ApiResponse({ status: 201, description: 'Batch accepted (duplicates reported)' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Unknown device token' })
  async ingest(
    @CurrentDevice() device: AuthenticatedDevice,
    @Body() dto: IngestEventsDto,
  ): Promise<IngestResult> {
    return this.eventsService.ingest(device.deviceId, dto.events);
  }
}
