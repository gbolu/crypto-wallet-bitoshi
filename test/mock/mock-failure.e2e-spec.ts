import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from '../../src/common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { OtelLoggerService } from '../../src/common/logger/otel-logger.service';
import { MetricsService } from '../../src/common/metrics/metrics.service';
import { MockFailureController } from '../../src/common/mock/controllers/mock-failure.controller';
import { MockFailureType } from '../../src/common/mock/dto/mock-failure-type.enum';

describe('Mock Failure Endpoint (e2e)', () => {
  let app: INestApplication;
  let metricsService: MetricsService;

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  const readErrorCounter = (metrics: string, errorType: string): number => {
    const escapedErrorType = errorType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = metrics.match(
      new RegExp(
        `bitoshi_application_errors_total\\{error_type="${escapedErrorType}"\\} (\\d+(?:\\.\\d+)?)`,
      ),
    );
    return match ? Number(match[1]) : 0;
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MockFailureController],
      providers: [MetricsService, OtelLoggerService],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(
      new CorrelationIdInterceptor(),
      new LoggingInterceptor(app.get(OtelLoggerService), app.get(MetricsService)),
    );
    app.useGlobalFilters(new AllExceptionsFilter(app.get(OtelLoggerService)));
    await app.init();

    metricsService = app.get(MetricsService);
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    [MockFailureType.INVALID_INPUT, 400],
    [MockFailureType.ENTITY_NOT_FOUND, 404],
    [MockFailureType.INSUFFICIENT_BALANCE, 422],
    [MockFailureType.ASSET_MISMATCH, 422],
    [MockFailureType.INTERNAL, 500],
  ])(
    'returns mapped status for %s',
    async (errorType: MockFailureType, expectedStatus: number) => {
      const response = await request(getServer())
        .post('/mock/failure')
        .send({ errorType })
        .expect(expectedStatus);

      const payload = response.body as {
        error: { statusCode: number; message: unknown };
      };
      expect(payload.error.statusCode).toBe(expectedStatus);
    },
  );

  it('returns 400 for unsupported error type', async () => {
    await request(getServer())
      .post('/mock/failure')
      .send({ errorType: 'not_supported' })
      .expect(400);
  });

  it('increments application error metric for thrown exceptions', async () => {
    const before = readErrorCounter(
      await metricsService.snapshot(),
      'InvalidInputException',
    );

    await request(getServer())
      .post('/mock/failure')
      .send({ errorType: MockFailureType.INVALID_INPUT })
      .expect(400);

    const after = readErrorCounter(
      await metricsService.snapshot(),
      'InvalidInputException',
    );
    expect(after).toBeGreaterThan(before);
  });
});
