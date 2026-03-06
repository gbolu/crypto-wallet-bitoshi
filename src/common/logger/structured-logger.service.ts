import { Injectable } from '@nestjs/common';
import { OtelLoggerService } from './otel-logger.service';

@Injectable()
export class StructuredLoggerService extends OtelLoggerService {}
