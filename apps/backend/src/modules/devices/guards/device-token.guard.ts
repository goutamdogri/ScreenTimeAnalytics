import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedDevice {
  deviceId: string;
  userId: string;
}

/**
 * Validates the opaque `x-device-token` header and attaches the resolved device
 * identity to the request (as `request.device`). Used by the heartbeat and
 * `POST /events` endpoints.
 *
 * Unknown or missing tokens produce 404 (matching the existing heartbeat spec
 * expectation — the device is "not found") rather than 401, which is reserved
 * for human-facing JWT auth failures.
 */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-device-token'] as string | undefined;

    if (!token) {
      throw new NotFoundException('Missing x-device-token header');
    }

    const device = await this.prisma.device.findUnique({
      where: { deviceToken: token },
      select: { id: true, userId: true },
    });

    if (!device) {
      throw new NotFoundException('Unknown device token');
    }

    request.device = { deviceId: device.id, userId: device.userId } satisfies AuthenticatedDevice;
    return true;
  }
}
