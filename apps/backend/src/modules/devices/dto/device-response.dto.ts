import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { DevicePlatform } from '../device-platform';

export class DeviceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 'Gaming Rig', maxLength: 100 })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['linux-x11', 'linux-wayland', 'windows', 'macos', 'unknown'] })
  @IsString()
  platform!: DevicePlatform;

  @ApiPropertyOptional({ description: 'Opaque token the device presents for ingest API calls' })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDate()
  lastSeenAt?: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @IsDate()
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @IsDate()
  updatedAt!: Date;
}

export class DeviceHeartbeatResultDto {
  @ApiProperty()
  @IsBoolean()
  success!: true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
