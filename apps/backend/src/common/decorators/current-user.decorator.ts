import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthenticatedUserWithJti extends AuthenticatedUser {
  jti: string;
}

/**
 * Extracts the authenticated user attached to the request by the Passport
 * strategies used with the `@UseGuards(...)` decorators.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
