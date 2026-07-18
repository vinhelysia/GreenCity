import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestId } from './request-id';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = getRequestId(req);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = HttpStatus[status] ?? 'HTTP_ERROR';
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        message =
          typeof obj.message === 'string'
            ? obj.message
            : Array.isArray(obj.message)
              ? obj.message.join('; ')
              : exception.message;
        code =
          typeof obj.code === 'string'
            ? obj.code
            : typeof obj.error === 'string'
              ? obj.error
              : (HttpStatus[status] ?? 'HTTP_ERROR');
        if (obj.details !== undefined) details = obj.details;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error requestId=${requestId}: ${exception.message}`,
      );
    }

    res.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        requestId,
      },
    });
  }
}
