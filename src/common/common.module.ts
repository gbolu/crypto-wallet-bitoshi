import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { OtelLoggerService } from './logger/otel-logger.service';
import { StructuredLoggerService } from './logger/structured-logger.service';
import { MetricsService } from './metrics/metrics.service';
import { MockFailureController } from './mock/controllers/mock-failure.controller';

const commonControllers =
  process.env.NODE_ENV === 'production'
    ? [HealthController]
    : [HealthController, MockFailureController];

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
    TerminusModule,
  ],
  controllers: commonControllers,
  providers: [
    OtelLoggerService,
    {
      provide: StructuredLoggerService,
      useExisting: OtelLoggerService,
    },
    MetricsService,
  ],
  exports: [OtelLoggerService, StructuredLoggerService, MetricsService],
})
export class CommonModule {}
