import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { ClassificationModule } from '../classification/classification.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [DevicesModule, ClassificationModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
