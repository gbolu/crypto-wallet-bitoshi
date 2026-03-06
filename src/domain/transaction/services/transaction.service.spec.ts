import { QueryFailedError } from 'typeorm';
import { Asset } from '../enums/asset.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  const walletId = 'wallet-1';
  const idempotencyKey = 'idem-key-1';

  const makeService = () => {
    const dataSource = {
      transaction: jest.fn(),
    };
    const walletRepository = {
      findById: jest.fn(),
      debitForWithdrawal: jest.fn(),
      creditForDeposit: jest.fn(),
    };
    const transactionRepository = {
      findByIdempotencyKey: jest.fn(),
      createAndSave: jest.fn(),
      listByWallet: jest.fn(),
    };
    const logger = {
      event: jest.fn(),
    };
    const metricsService = {
      incrementWithdrawalsCreated: jest.fn(),
      incrementDepositsCreated: jest.fn(),
      incrementError: jest.fn(),
      incrementIdempotentReplay: jest.fn(),
      incrementDbConflict: jest.fn(),
    };

    const service = new TransactionService(
      dataSource as never,
      walletRepository as never,
      transactionRepository as never,
      logger as never,
      metricsService as never,
    );

    return {
      service,
      dataSource,
      walletRepository,
      transactionRepository,
      logger,
      metricsService,
    };
  };

  it('uses type-scoped idempotency lookup for withdrawals', async () => {
    const {
      service,
      walletRepository,
      transactionRepository,
      metricsService,
      dataSource,
    } = makeService();

    const existingTx = {
      id: 'tx-1',
      walletId,
      type: TransactionType.WITHDRAWAL,
      asset: Asset.BTC,
      amount: '0.01',
      network: 'Bitcoin',
      status: TransactionStatus.PENDING,
      txHash: null,
      confirmedAt: null,
      createdAt: new Date(),
    };

    walletRepository.findById.mockResolvedValue({
      id: walletId,
      asset: Asset.BTC,
    });
    transactionRepository.findByIdempotencyKey.mockResolvedValue(existingTx);
    dataSource.transaction.mockImplementation(async () => {
      throw new Error('should not execute transactional create path');
    });

    const result = await service.createWithdrawal(
      walletId,
      { asset: Asset.BTC, amount: '0.01', toAddress: 'bc1qexample' },
      idempotencyKey,
    );

    expect(transactionRepository.findByIdempotencyKey).toHaveBeenCalledWith(
      walletId,
      idempotencyKey,
      TransactionType.WITHDRAWAL,
    );
    expect(metricsService.incrementIdempotentReplay).toHaveBeenCalledWith(
      TransactionType.WITHDRAWAL,
    );
    expect(result.isReplay).toBe(true);
  });

  it('does not swallow unrelated unique-constraint violations', async () => {
    const {
      service,
      dataSource,
      walletRepository,
      transactionRepository,
      metricsService,
    } = makeService();

    walletRepository.findById.mockResolvedValue({
      id: walletId,
      asset: Asset.BTC,
    });
    transactionRepository.findByIdempotencyKey.mockResolvedValue(null);

    walletRepository.debitForWithdrawal.mockResolvedValue(true);
    transactionRepository.createAndSave.mockRejectedValue(
      new QueryFailedError('insert', [], {
        code: '23505',
        constraint: 'some_other_unique_constraint',
      }),
    );

    dataSource.transaction.mockImplementation(async (handler: never) =>
      handler({}),
    );

    await expect(
      service.createWithdrawal(
        walletId,
        { asset: Asset.BTC, amount: '0.01', toAddress: 'bc1qexample' },
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(QueryFailedError);

    expect(metricsService.incrementDbConflict).not.toHaveBeenCalled();
  });
});
