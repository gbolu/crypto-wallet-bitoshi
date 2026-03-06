import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OtelLoggerService } from '../../../common/logger/otel-logger.service';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { AmountUtil } from '../../../common/utils/amount.util';
import { WalletEntity } from '../../wallet/entities/wallet.entity';
import { TransactionStateMachine } from '../guards/transaction-state-machine';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionRepository } from '../repositories/transaction.repository';

@Injectable()
export class TransactionStatusWorker {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionRepository: TransactionRepository,
    private readonly logger: OtelLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingTransactions(): Promise<void> {
    const batchStartedAt = Date.now();
    const workerRunId = randomUUID();
    const candidates = await this.transactionRepository.findPendingOlderThan(
      60_000,
      50,
    );
    this.metricsService.setPendingTransactionsBacklog(candidates.length);
    if (!candidates.length) {
      return;
    }

    for (const candidate of candidates) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const startedAt = Date.now();
          const txRepo = manager.getRepository(TransactionEntity);
          const walletRepo = manager.getRepository(WalletEntity);

          const tx = await txRepo.findOne({
            where: { id: candidate.id },
            lock: { mode: 'pessimistic_write' },
          });

          if (!tx || tx.status !== TransactionStatus.PENDING) {
            return;
          }

          const wallet = await walletRepo.findOne({
            where: { id: tx.walletId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!wallet) {
            return;
          }

          const nextStatus =
            Math.random() < 0.8
              ? TransactionStatus.CONFIRMED
              : TransactionStatus.FAILED;
          const resolvedStatus = TransactionStateMachine.transition(
            tx.status,
            nextStatus,
          );

          if (resolvedStatus === TransactionStatus.CONFIRMED) {
            wallet.lockedBalance = AmountUtil.subtract(
              wallet.lockedBalance,
              tx.amount,
            );
            const confirmedAt = new Date();
            const txHash = `0x${tx.id.replace(/-/g, '')}`;
            const transitioned =
              await this.transactionRepository.transitionFromPending(
                tx.id,
                TransactionStatus.CONFIRMED,
                manager,
                {
                  txHash,
                  confirmedAt,
                },
              );
            if (!transitioned) {
              this.metricsService.incrementTransitionConflict();
              this.logger.event(
                'warn',
                'transaction_transition_conflict',
                {
                  transactionId: tx.id,
                  workerRunId,
                  fromStatus: TransactionStatus.PENDING,
                  attemptedStatus: TransactionStatus.CONFIRMED,
                  reason: 'compare_and_set_no_rows',
                },
                TransactionStatusWorker.name,
              );
              return;
            }
            this.metricsService.incrementTransitionConfirmed();
            this.metricsService.observeConfirmationLatency(
              Math.max(0, confirmedAt.getTime() - tx.createdAt.getTime()),
              'confirmed',
            );

            await walletRepo.save(wallet);

            this.logger.event(
              'log',
              'transaction_state_transition',
              {
                transactionId: tx.id,
                walletId: tx.walletId,
                amount: tx.amount,
                fromStatus: TransactionStatus.PENDING,
                toStatus: TransactionStatus.CONFIRMED,
                durationMs: Date.now() - startedAt,
                reason: 'simulated_network_confirmation',
                workerRunId,
                attempt: 1,
                settlementRef: txHash,
              },
              TransactionStatusWorker.name,
            );
            return;
          } else {
            wallet.lockedBalance = AmountUtil.subtract(
              wallet.lockedBalance,
              tx.amount,
            );
            wallet.availableBalance = AmountUtil.add(
              wallet.availableBalance,
              tx.amount,
            );
            const transitioned =
              await this.transactionRepository.transitionFromPending(
                tx.id,
                TransactionStatus.FAILED,
                manager,
                {
                  txHash: null,
                  confirmedAt: null,
                },
              );
            if (!transitioned) {
              this.metricsService.incrementTransitionConflict();
              this.logger.event(
                'warn',
                'transaction_transition_conflict',
                {
                  transactionId: tx.id,
                  workerRunId,
                  fromStatus: TransactionStatus.PENDING,
                  attemptedStatus: TransactionStatus.FAILED,
                  reason: 'compare_and_set_no_rows',
                },
                TransactionStatusWorker.name,
              );
              return;
            }
            this.metricsService.incrementTransitionFailed();
            this.metricsService.observeConfirmationLatency(
              Math.max(0, Date.now() - tx.createdAt.getTime()),
              'failed',
            );

            await walletRepo.save(wallet);

            this.logger.event(
              'log',
              'transaction_state_transition',
              {
                transactionId: tx.id,
                walletId: tx.walletId,
                amount: tx.amount,
                fromStatus: TransactionStatus.PENDING,
                toStatus: TransactionStatus.FAILED,
                durationMs: Date.now() - startedAt,
                reason: 'simulated_network_failure',
                workerRunId,
                attempt: 1,
                settlementRef: null,
              },
              TransactionStatusWorker.name,
            );
            return;
          }
        });
      } catch (error) {
        const errorName =
          error instanceof Error ? error.name : 'TransactionWorkerError';
        this.metricsService.incrementError(errorName);
        this.logger.event(
          'error',
          'transaction_processing_failed',
          {
            candidateId: candidate.id,
            workerRunId,
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { value: String(error) },
          },
          TransactionStatusWorker.name,
        );
      }
    }

    this.logger.event(
      'log',
      'processed_pending_transactions_batch',
      { count: candidates.length },
      TransactionStatusWorker.name,
    );
    this.metricsService.observeWorkerBatchDuration(Date.now() - batchStartedAt);
  }
}
