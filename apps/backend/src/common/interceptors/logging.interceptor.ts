import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { Observable, catchError, tap, throwError } from 'rxjs';

/**
 * Attaches a `requestId` to every request and logs a structured summary line
 * for each response (method, path, status, duration, requestId).
 *
 * Registered globally in `main.ts`; `requestId` is also echoed in error
 * payloads by {@link AllExceptionsFilter}.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    const requestId = randomUUID();
    request.id = requestId;

    const { method, originalUrl } = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<{ statusCode: number }>();
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} ${Math.round(performance.now() - start)}ms requestId=${requestId}`,
        );
      }),
      catchError((error: unknown) => {
        const status =
          (error as { status?: number } | undefined)?.status ??
          (error as { response?: { statusCode?: number } } | undefined)?.response?.statusCode ??
          500;
        this.logger.warn(
          `${method} ${originalUrl} ${status} ${Math.round(performance.now() - start)}ms requestId=${requestId}`,
        );
        return throwError(() => error);
      }),
    );
  }
}
