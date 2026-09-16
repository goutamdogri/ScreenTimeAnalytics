import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedDevice } from './guards/device-token.guard';

/**
 * Extracts the device identity attached to the request by `DeviceTokenGuard`.
 */
export const CurrentDevice = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedDevice => {
    const request = context.switchToHttp().getRequest<{ device: AuthenticatedDevice }>();
    return request.device;
  },
);
