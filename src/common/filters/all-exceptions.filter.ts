import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { OtelLoggerService } from '../logger/otel-logger.service';

type CorrelatedRequest = Request & { correlationId?: string };

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: OtelLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<CorrelatedRequest>();

    const isHttpException = exception instanceof HttpException;
    const isDomainException = exception instanceof DomainException;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (isHttpException) {
      statusCode = exception.getStatus();
      message = exception.getResponse();
    } else if (isDomainException) {
      statusCode = this.mapDomainExceptionToStatus(exception);
      message = exception.message;
    } else {
      const error =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.event(
        'error',
        'unhandled_exception',
        {
          method: req.method,
          path: req.url,
          correlationId: req.correlationId ?? null,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        AllExceptionsFilter.name,
      );
    }

    res.status(statusCode).json({
      error: {
        statusCode,
        message,
        path: req.url,
        correlationId: req.correlationId ?? null,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private mapDomainExceptionToStatus(exception: DomainException): number {
    switch (exception.code) {
      case 'ENTITY_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'INSUFFICIENT_BALANCE':
      case 'ASSET_MISMATCH':
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case 'INVALID_INPUT':
        return HttpStatus.BAD_REQUEST;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
