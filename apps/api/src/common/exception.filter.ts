import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

const statusCodes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : null;
    const rawObject = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const rawMessage = rawObject.message;
    const details = Array.isArray(rawMessage) ? rawMessage : undefined;
    const message =
      status >= 500
        ? 'The request could not be completed.'
        : Array.isArray(rawMessage)
          ? 'One or more fields are invalid.'
          : typeof rawMessage === 'string'
            ? rawMessage
            : typeof raw === 'string'
              ? raw
              : exception instanceof Error
                ? exception.message
                : 'The request could not be completed.';
    const requestId = request.id ?? request.headers['x-request-id']?.toString() ?? 'unknown';

    if (status >= 500) {
      this.logger.error(
        { requestId, method: request.method, path: request.originalUrl, status, err: exception },
        'request_failed',
      );
    } else {
      this.logger.warn(
        { requestId, method: request.method, path: request.originalUrl, status },
        'request_rejected',
      );
    }

    response.status(status).json({
      error: {
        code: statusCodes[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
        message,
        ...(details ? { details } : {}),
        requestId,
      },
    });
  }
}
