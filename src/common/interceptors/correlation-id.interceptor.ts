import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';

type CorrelatedRequest = Request & { correlationId?: string };

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<CorrelatedRequest>();
    const res = http.getResponse<Response>();

    const incomingId = req.headers['x-correlation-id'];
    const correlationId =
      typeof incomingId === 'string' && incomingId.trim()
        ? incomingId
        : randomUUID();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    return next.handle();
  }
}
