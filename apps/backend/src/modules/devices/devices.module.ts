import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceTokenGuard } from './guards/device-token.guard';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, DeviceTokenGuard],
  exports: [DevicesService, DeviceTokenGuard],
})
export class DevicesModule {}

export { CurrentDevice } from './current-device.decorator';
export type { AuthenticatedDevice } from './guards/device-token.guard';
