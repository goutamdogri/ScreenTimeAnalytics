import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceDto } from './dto/device-response.dto';
import { RegisterDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a new device and receive its opaque device token' })
  @ApiResponse({ status: 201, type: DeviceDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 400, description: 'Validation failed or device name taken' })
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<any> {
    return this.devicesService.register(user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the authenticated user’s devices' })
  @ApiResponse({ status: 200, type: [DeviceDto] })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.list(user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Rename a device or change its platform' })
  @ApiResponse({ status: 200, type: DeviceDto })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDeviceDto,
  ): Promise<any> {
    return this.devicesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister a device' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.devicesService.remove(user.userId, id);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report device activity (authenticated with the opaque device token)',
  })
  @ApiResponse({ status: 200, description: 'Activity recorded' })
  @ApiResponse({ status: 404, description: 'Unknown device token' })
  async heartbeat(@Headers('x-device-token') deviceToken: string): Promise<{ success: true }> {
    await this.devicesService.heartbeat(deviceToken);
    return { success: true };
  }
}
