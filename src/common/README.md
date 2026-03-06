# Common Module

`src/common` contains shared infrastructure reused across all domains.

## Purpose

- Provide global app wiring for config, database, health checks, logging, metrics, and cross-cutting middleware.
- Keep technical concerns out of domain modules.

## Key Components

### `common.module.ts`

- Declared as `@Global()`.
- Boots:
  - `ConfigModule` with `app.config.ts` and `database.config.ts`
  - `DatabaseModule` (TypeORM connection)
  - `TerminusModule` (health indicators)
- Exposes:
  - `OtelLoggerService`
  - `StructuredLoggerService` (alias of `OtelLoggerService`)
  - `MetricsService`
- Registers `HealthController`.

### `config/`

- `app.config.ts`:
  - `NODE_ENV`, `PORT`, `API_PREFIX`, `API_KEY`
- `database.config.ts`:
  - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_SSL`

### `database/`

- `base.entity.ts`: shared `id`, `created_at`, `updated_at` columns for entities.
- `base.repository.ts`:
  - generic `findById()` and `save()`
  - cursor helpers (`encodeCursor`, `decodeCursor`)
  - throws `InvalidInputException` on invalid cursor decode.
- `database.module.ts`: async TypeORM config using `ConfigService`, `autoLoadEntities: true`, `synchronize: false`.

### `dto/`

- `cursor-pagination-query.dto.ts`:
  - optional `cursor`
  - optional `limit` (`1-100`, default `20`)
- `paginated-response.dto.ts`:
  - standard `{ data, nextCursor }` interface.

### `exceptions/`

- `domain.exception.ts` base class with `code`.
- Domain-specific subclasses:
  - `EntityNotFoundException`
  - `InsufficientBalanceException`
  - `AssetMismatchException`
  - `InvalidInputException`

These exceptions are mapped to HTTP status codes by the global exception filter.

### `filters/`

- `all-exceptions.filter.ts`:
  - catches any unhandled exception
  - maps `DomainException` codes to status codes (`400`, `404`, `422`)
  - preserves HTTP exceptions from Nest
  - attaches `correlationId` and request path to error responses.
- `all-exceptions.filter.spec.ts` validates this mapping behavior.

### `guards/`

- `api-key.guard.ts`:
  - validates `x-api-key` header against configured `app.apiKey`
  - throws `UnauthorizedException` when invalid.

### `interceptors/`

- `correlation-id.interceptor.ts`:
  - reads `x-correlation-id` from incoming request or generates UUID
  - stores it on request and response headers.
- `logging.interceptor.ts`:
  - emits structured request-completion and request-failure events
  - includes method, URL, status code, duration, correlation ID, wallet ID, request payload size
  - increments error counters in `MetricsService` for failed requests.

### `logger/`

- `otel-logger.service.ts`:
  - structured JSON logs
  - includes OpenTelemetry trace/span IDs when available
  - supports `event()` helper for domain/app events.
- `structured-logger.service.ts`: convenience alias extending `OtelLoggerService`.

### `metrics/`

- `metrics.service.ts`:
  - in-memory counters for:
    - withdrawals created
    - transition outcomes (confirmed/failed)
    - errors by type.

### `otel/`

- `otel.ts`:
  - initializes OpenTelemetry Node SDK
  - auto-instrumentation enabled
  - OTLP exporter supports `http/protobuf` and `grpc`
  - includes graceful shutdown helper.

### `health/`

- `health.controller.ts`:
  - `GET /health/db`
  - validates database connectivity via `TypeOrmHealthIndicator`.
