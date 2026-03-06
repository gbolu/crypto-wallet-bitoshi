import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { AssetMismatchException } from '../../../common/exceptions/asset-mismatch.exception';
import { EntityNotFoundException } from '../../../common/exceptions/entity-not-found.exception';
import { InsufficientBalanceException } from '../../../common/exceptions/insufficient-balance.exception';
import { InvalidInputException } from '../../../common/exceptions/invalid-input.exception';
import { OtelLoggerService } from '../../../common/logger/otel-logger.service';
import { MetricsService } from '../../../common/metrics/metrics.service';
import { AmountUtil } from '../../../common/utils/amount.util';
import { WalletRepository } from '../../wallet/repositories/wallet.repository';
import { CreateDepositDto } from '../dto/create-deposit.dto';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { TransactionResponseDto } from '../dto/transaction-response.dto';
import { Asset } from '../enums/asset.enum';
import { Network } from '../enums/network.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionRepository } from '../repositories/transaction.repository';

@Injectable()
export class TransactionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly logger: OtelLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  async getWalletTransactions(
    walletId: string,
    filters: TransactionFilterDto,
  ): Promise<{ data: TransactionResponseDto[]; nextCursor: string | null }> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw new EntityNotFoundException('Wallet', walletId);
    }

    const result = await this.transactionRepository.listByWallet(
      walletId,
      filters,
    );
    return {
      data: result.data.map((transaction) => this.toResponse(transaction)),
      nextCursor: result.nextCursor,
    };
  }

  async createWithdrawal(
    walletId: string,
    dto: CreateWithdrawalDto,
    idempotencyKey: string | undefined,
  ): Promise<{ transaction: TransactionResponseDto; isReplay: boolean }> {
    if (!idempotencyKey) {
      throw new InvalidInputException('Idempotency-Key header is required');
    }

    if (!AmountUtil.parse(dto.amount).gt(0)) {
      throw new InvalidInputException('amount must be greater than zero');
    }

    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw new EntityNotFoundException('Wallet', walletId);
    }

    if (wallet.asset !== dto.asset) {
      throw new AssetMismatchException(walletId, wallet.asset, dto.asset);
    }

    const existing = await this.transactionRepository.findByIdempotencyKey(
      walletId,
      idempotencyKey,
      TransactionType.WITHDRAWAL,
    );
    if (existing) {
      this.metricsService.incrementIdempotentReplay(TransactionType.WITHDRAWAL);
      this.logger.event(
        'log',
        'withdrawal_idempotent_replay',
        {
          walletId,
          asset: existing.asset,
          amount: existing.amount,
          idempotencyKey,
          transactionId: existing.id,
        },
        TransactionService.name,
      );
      return { transaction: this.toResponse(existing), isReplay: true };
    }

    const network = this.resolveNetwork(dto.asset);

    try {
      const transaction = await this.dataSource.transaction(async (manager) => {
        const debited = await this.walletRepository.debitForWithdrawal(
          walletId,
          dto.asset,
          dto.amount,
          manager,
        );
        if (!debited) {
          throw new InsufficientBalanceException();
        }

        return this.transactionRepository.createAndSave(
          {
            walletId,
            type: TransactionType.WITHDRAWAL,
            asset: dto.asset,
            amount: dto.amount,
            toAddress: dto.toAddress,
            network,
            status: TransactionStatus.PENDING,
            txHash: null,
            idempotencyKey,
          },
          manager,
        );
      });

      this.metricsService.incrementWithdrawalsCreated();
      this.logger.event(
        'log',
        'withdrawal_created',
        {
          walletId,
          asset: dto.asset,
          amount: dto.amount,
          idempotencyKey,
          transactionId: transaction.id,
          status: transaction.status,
        },
        TransactionService.name,
      );
      return { transaction: this.toResponse(transaction), isReplay: false };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        if (this.isScopedIdempotencyConflict(error)) {
          this.metricsService.incrementDbConflict('withdrawal_create');
          const replay = await this.transactionRepository.findByIdempotencyKey(
            walletId,
            idempotencyKey,
            TransactionType.WITHDRAWAL,
          );
          if (replay) {
            this.metricsService.incrementIdempotentReplay(
              TransactionType.WITHDRAWAL,
            );
            this.logger.event(
              'log',
              'withdrawal_idempotent_replay',
              {
                walletId,
                asset: replay.asset,
                amount: replay.amount,
                idempotencyKey,
                transactionId: replay.id,
              },
              TransactionService.name,
            );
            return { transaction: this.toResponse(replay), isReplay: true };
          }
        }
      }
      const errorName =
        error instanceof Error ? error.name : 'CreateWithdrawalError';
      this.metricsService.incrementError(errorName);
      this.logger.event(
        'error',
        'withdrawal_create_failed',
        {
          walletId,
          asset: dto.asset,
          amount: dto.amount,
          idempotencyKey,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { value: String(error) },
        },
        TransactionService.name,
      );
      throw error;
    }
  }

  async createDeposit(
    walletId: string,
    dto: CreateDepositDto,
    idempotencyKey: string | undefined,
  ): Promise<{ transaction: TransactionResponseDto; isReplay: boolean }> {
    if (!idempotencyKey) {
      throw new InvalidInputException('Idempotency-Key header is required');
    }

    if (!AmountUtil.parse(dto.amount).gt(0)) {
      throw new InvalidInputException('amount must be greater than zero');
    }

    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw new EntityNotFoundException('Wallet', walletId);
    }

    if (wallet.asset !== dto.asset) {
      throw new AssetMismatchException(walletId, wallet.asset, dto.asset);
    }

    const existing = await this.transactionRepository.findByIdempotencyKey(
      walletId,
      idempotencyKey,
      TransactionType.DEPOSIT,
    );
    if (existing) {
      this.metricsService.incrementIdempotentReplay(TransactionType.DEPOSIT);
      this.logger.event(
        'log',
        'deposit_idempotent_replay',
        {
          walletId,
          asset: existing.asset,
          amount: existing.amount,
          idempotencyKey,
          transactionId: existing.id,
        },
        TransactionService.name,
      );
      return { transaction: this.toResponse(existing), isReplay: true };
    }

    const network = this.resolveNetwork(dto.asset);

    try {
      const transaction = await this.dataSource.transaction(async (manager) => {
        const credited = await this.walletRepository.creditForDeposit(
          walletId,
          dto.asset,
          dto.amount,
          manager,
        );
        if (!credited) {
          throw new EntityNotFoundException('Wallet', walletId);
        }

        return this.transactionRepository.createAndSave(
          {
            walletId,
            type: TransactionType.DEPOSIT,
            asset: dto.asset,
            amount: dto.amount,
            toAddress: null,
            network,
            status: TransactionStatus.CONFIRMED,
            txHash: null,
            confirmedAt: new Date(),
            idempotencyKey,
          },
          manager,
        );
      });

      this.metricsService.incrementDepositsCreated();
      this.logger.event(
        'log',
        'deposit_created',
        {
          walletId,
          asset: dto.asset,
          amount: dto.amount,
          idempotencyKey,
          transactionId: transaction.id,
          status: transaction.status,
        },
        TransactionService.name,
      );
      return { transaction: this.toResponse(transaction), isReplay: false };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        if (this.isScopedIdempotencyConflict(error)) {
          this.metricsService.incrementDbConflict('deposit_create');
          const replay = await this.transactionRepository.findByIdempotencyKey(
            walletId,
            idempotencyKey,
            TransactionType.DEPOSIT,
          );
          if (replay) {
            this.metricsService.incrementIdempotentReplay(
              TransactionType.DEPOSIT,
            );
            this.logger.event(
              'log',
              'deposit_idempotent_replay',
              {
                walletId,
                asset: replay.asset,
                amount: replay.amount,
                idempotencyKey,
                transactionId: replay.id,
              },
              TransactionService.name,
            );
            return { transaction: this.toResponse(replay), isReplay: true };
          }
        }
      }
      const errorName =
        error instanceof Error ? error.name : 'CreateDepositError';
      this.metricsService.incrementError(errorName);
      this.logger.event(
        'error',
        'deposit_create_failed',
        {
          walletId,
          asset: dto.asset,
          amount: dto.amount,
          idempotencyKey,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { value: String(error) },
        },
        TransactionService.name,
      );
      throw error;
    }
  }

  private resolveNetwork(asset: Asset): Network {
    if (asset === Asset.BTC) {
      return Network.BITCOIN;
    }
    return Network.ETHEREUM;
  }

  private toResponse(tx: TransactionEntity): TransactionResponseDto {
    return {
      id: `tx_${tx.id}`,
      walletId: tx.walletId,
      type: tx.type,
      asset: tx.asset,
      amount: tx.amount,
      network: tx.network,
      status: tx.status,
      txHash: tx.txHash,
      confirmedAt: tx.confirmedAt ? tx.confirmedAt.toISOString() : null,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  private isScopedIdempotencyConflict(error: QueryFailedError): boolean {
    const postgresError = error.driverError as {
      code?: string;
      constraint?: string;
    };
    return (
      postgresError.code === '23505' &&
      postgresError.constraint === 'transactions_wallet_type_idempotency_key_uidx'
    );
  }
}
