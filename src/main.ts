import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { OtelLoggerService } from './common/logger/otel-logger.service';
import { startOpenTelemetry, stopOpenTelemetry } from './common/otel/otel';

async function bootstrap() {
  startOpenTelemetry();
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(OtelLoggerService));
  const configService = app.get(ConfigService);
  const apiPrefix = configService.getOrThrow<string>('app.apiPrefix');
  const port = configService.getOrThrow<number>('app.port');

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix(apiPrefix);
  app.enableShutdownHooks();

  await app.listen(port);
}
void bootstrap().catch(async (error: unknown) => {
  await stopOpenTelemetry();
  throw error;
});

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of shutdownSignals) {
  process.once(signal, () => {
    void stopOpenTelemetry();
  });
}
