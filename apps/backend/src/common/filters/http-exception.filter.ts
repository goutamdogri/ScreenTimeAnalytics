import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Global exception filter producing a consistent error envelope for every
 * request, and logging 5xx failures through the structured logger.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorResponseBody = {
      statusCode: status,
      message: this.extractMessage(exception, status),
      error: this.extractErrorName(exception, status),
      path: request.originalUrl ?? request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} → ${status} (requestId=${request.id ?? 'n/a'})`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl ?? request.url} → ${status} (requestId=${request.id ?? 'n/a'})`,
      );
    }

    response.status(status).json(body);
  }

  private extractMessage(exception: unknown, _status: number): string | string[] {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return payload;
      }
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (Array.isArray(message)) {
          return message.map((item) => String(item));
        }
        if (typeof message === 'string') {
          return message;
        }
      }
      return exception.message;
    }
    if (exception instanceof Error && exception.message) {
      return exception.message;
    }
    return 'Internal server error';
  }

  private extractErrorName(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        return String((payload as { error?: unknown }).error ?? exception.name);
      }
      return exception.name;
    }
    return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal Server Error' : 'Error';
  }
}
