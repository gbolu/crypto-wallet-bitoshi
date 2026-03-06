import { Injectable, LoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable()
export class OtelLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, traceText?: string, context?: string): void {
    this.write('error', message, context, { trace: traceText });
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  event(
    level: LogLevel,
    event: string,
    metadata: Record<string, unknown> = {},
    context = 'Application',
  ): void {
    this.write(level, event, context, metadata);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const spanContext = trace.getActiveSpan()?.spanContext();
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message: this.normalize(message),
      traceId: spanContext?.traceId ?? null,
      spanId: spanContext?.spanId ?? null,
      ...metadata,
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  private normalize(message: unknown): unknown {
    if (message instanceof Error) {
      return {
        name: message.name,
        message: message.message,
        stack: message.stack,
      };
    }
    return message;
  }
}
