import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { OtelLoggerService } from '../logger/otel-logger.service';
import { MetricsService } from '../metrics/metrics.service';

type CorrelatedRequest = Request & { correlationId?: string };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: OtelLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<CorrelatedRequest>();
    const res = http.getResponse<Response>();
    const method = req.method;
    const url = req.originalUrl;
    const walletId = req.params?.walletId ?? null;
    const correlationId = req.correlationId ?? 'n/a';
    const requestSizeBytes = this.measureBodySize(req.body);

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsedMs = Date.now() - startedAt;
          this.metricsService.observeHttpRequestDuration(
            elapsedMs,
            method,
            url,
            res.statusCode,
          );
          this.logger.event(
            'log',
            'http_request_completed',
            {
              method,
              url,
              statusCode: res.statusCode,
              elapsedMs,
              correlationId,
              walletId,
              requestSizeBytes,
            },
            LoggingInterceptor.name,
          );
        },
        error: (error: unknown) => {
          const elapsedMs = Date.now() - startedAt;
          const errorName =
            error instanceof Error ? error.name : 'UnknownRequestError';
          this.metricsService.observeHttpRequestDuration(
            elapsedMs,
            method,
            url,
            res.statusCode,
          );
          this.metricsService.incrementError(errorName);
          this.logger.event(
            'error',
            'http_request_failed',
            {
              method,
              url,
              statusCode: res.statusCode,
              elapsedMs,
              correlationId,
              walletId,
              requestSizeBytes,
              error: this.toErrorPayload(error),
            },
            LoggingInterceptor.name,
          );
        },
      }),
    );
  }

  private measureBodySize(body: unknown): number {
    if (body === undefined || body === null) {
      return 0;
    }
    try {
      return Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      return 0;
    }
  }

  private toErrorPayload(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return { value: String(error) };
  }
}
