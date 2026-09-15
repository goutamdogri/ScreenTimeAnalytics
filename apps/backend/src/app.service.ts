import { Injectable } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service';

export const SERVICE_VERSION = '0.1.0';

export interface HealthStatus {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  database: 'up';
}

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<HealthStatus> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      version: SERVICE_VERSION,
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      database: 'up',
    };
  }
}
