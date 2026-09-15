import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DEVICE_PLATFORMS, DevicePlatform } from '../device-platform';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'Gaming Rig', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: DEVICE_PLATFORMS, example: 'linux-x11' })
  @IsIn(DEVICE_PLATFORMS)
  platform!: DevicePlatform;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional({ example: 'Living Room PC', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: DEVICE_PLATFORMS })
  @IsOptional()
  @IsIn(DEVICE_PLATFORMS)
  platform?: DevicePlatform;
}
