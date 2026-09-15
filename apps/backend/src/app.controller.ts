import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, HealthStatus } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness + database connectivity probe' })
  @ApiOkResponse({
    description: 'Service healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        version: { type: 'string' },
        uptimeSeconds: { type: 'number' },
        database: { type: 'string', enum: ['up'] },
      },
    },
  })
  async health(): Promise<HealthStatus> {
    return this.appService.health();
  }
}
