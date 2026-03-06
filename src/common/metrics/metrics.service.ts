import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { TransactionType } from '../../domain/transaction/enums/transaction-type.enum';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly depositsCreatedCounter: Counter<string>;
  private readonly withdrawalsCreatedCounter: Counter<string>;
  private readonly transactionTransitionsCounter: Counter<'status'>;
  private readonly applicationErrorsCounter: Counter<'error_type'>;
  private readonly idempotentReplaysCounter: Counter<'operation_type'>;
  private readonly dbConflictsCounter: Counter<'operation'>;
  private readonly transitionConflictsCounter: Counter<string>;
  private readonly httpRequestDurationHistogram: Histogram<
    'method' | 'route' | 'status_code'
  >;
  private readonly confirmationLatencyHistogram: Histogram<'status'>;
  private readonly workerBatchDurationHistogram: Histogram<'worker'>;
  private readonly pendingTransactionsGauge: Gauge<string>;

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'bitoshi_',
    });

    this.depositsCreatedCounter = new Counter({
      name: 'bitoshi_deposits_created_total',
      help: 'Total number of created deposits',
      registers: [this.registry],
    });

    this.withdrawalsCreatedCounter = new Counter({
      name: 'bitoshi_withdrawals_created_total',
      help: 'Total number of created withdrawals',
      registers: [this.registry],
    });

    this.transactionTransitionsCounter = new Counter({
      name: 'bitoshi_transaction_transitions_total',
      help: 'Total number of transaction state transitions by final status',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.applicationErrorsCounter = new Counter({
      name: 'bitoshi_application_errors_total',
      help: 'Total number of application errors by error type',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.idempotentReplaysCounter = new Counter({
      name: 'bitoshi_idempotent_replays_total',
      help: 'Total number of idempotent replay responses by operation type',
      labelNames: ['operation_type'],
      registers: [this.registry],
    });

    this.dbConflictsCounter = new Counter({
      name: 'bitoshi_db_conflicts_total',
      help: 'Total number of database conflicts by operation',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.transitionConflictsCounter = new Counter({
      name: 'bitoshi_transition_conflicts_total',
      help: 'Total number of transition update conflicts',
      registers: [this.registry],
    });

    this.httpRequestDurationHistogram = new Histogram({
      name: 'bitoshi_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    this.confirmationLatencyHistogram = new Histogram({
      name: 'bitoshi_confirmation_latency_ms',
      help: 'Latency from transaction creation to terminal status',
      labelNames: ['status'],
      buckets: [1000, 5000, 15000, 30000, 60000, 300000, 900000, 1800000],
      registers: [this.registry],
    });

    this.workerBatchDurationHistogram = new Histogram({
      name: 'bitoshi_worker_batch_duration_ms',
      help: 'Duration for processing a pending transaction batch',
      labelNames: ['worker'],
      buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
      registers: [this.registry],
    });

    this.pendingTransactionsGauge = new Gauge({
      name: 'bitoshi_pending_transactions_backlog',
      help: 'Current number of pending transactions selected for processing',
      registers: [this.registry],
    });
  }

  incrementDepositsCreated(): void {
    this.depositsCreatedCounter.inc();
  }

  incrementWithdrawalsCreated(): void {
    this.withdrawalsCreatedCounter.inc();
  }

  incrementTransitionConfirmed(): void {
    this.transactionTransitionsCounter.labels('confirmed').inc();
  }

  incrementTransitionFailed(): void {
    this.transactionTransitionsCounter.labels('failed').inc();
  }

  incrementError(errorType: string): void {
    this.applicationErrorsCounter.labels(errorType).inc();
  }

  incrementIdempotentReplay(operationType: TransactionType): void {
    this.idempotentReplaysCounter.labels(operationType).inc();
  }

  incrementDbConflict(operation: string): void {
    this.dbConflictsCounter.labels(operation).inc();
  }

  incrementTransitionConflict(): void {
    this.transitionConflictsCounter.inc();
  }

  observeHttpRequestDuration(
    elapsedMs: number,
    method: string,
    route: string,
    statusCode: number,
  ): void {
    this.httpRequestDurationHistogram
      .labels(method, route, String(statusCode))
      .observe(elapsedMs);
  }

  observeConfirmationLatency(
    elapsedMs: number,
    status: 'confirmed' | 'failed',
  ): void {
    this.confirmationLatencyHistogram.labels(status).observe(elapsedMs);
  }

  observeWorkerBatchDuration(elapsedMs: number): void {
    this.workerBatchDurationHistogram
      .labels('transaction_status_worker')
      .observe(elapsedMs);
  }

  setPendingTransactionsBacklog(count: number): void {
    this.pendingTransactionsGauge.set(count);
  }

  async snapshot(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
