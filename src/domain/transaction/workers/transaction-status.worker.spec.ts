import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionStatusWorker } from './transaction-status.worker';

describe('TransactionStatusWorker', () => {
  const makeWorker = () => {
    const transactionRepository = {
      findPendingOlderThan: jest.fn(),
      transitionFromPending: jest.fn(),
    };
    const logger = {
      event: jest.fn(),
    };
    const metricsService = {
      setPendingTransactionsBacklog: jest.fn(),
      incrementTransitionConflict: jest.fn(),
      incrementTransitionConfirmed: jest.fn(),
      incrementTransitionFailed: jest.fn(),
      observeConfirmationLatency: jest.fn(),
      observeWorkerBatchDuration: jest.fn(),
      incrementError: jest.fn(),
    };

    const txRepo = {
      findOne: jest.fn(),
    };
    const walletRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest
        .fn()
        .mockReturnValueOnce(txRepo)
        .mockReturnValueOnce(walletRepo),
    };

    const dataSource = {
      transaction: jest.fn(async (handler: (value: unknown) => unknown) =>
        handler(manager),
      ),
    };

    const worker = new TransactionStatusWorker(
      dataSource as never,
      transactionRepository as never,
      logger as never,
      metricsService as never,
    );

    return {
      worker,
      transactionRepository,
      metricsService,
      txRepo,
      walletRepo,
    };
  };

  it('records transition conflict when compare-and-set updates no rows', async () => {
    const { worker, transactionRepository, metricsService, txRepo, walletRepo } =
      makeWorker();

    transactionRepository.findPendingOlderThan.mockResolvedValue([{ id: 'tx-1' }]);
    txRepo.findOne.mockResolvedValue({
      id: 'tx-1',
      walletId: 'wallet-1',
      status: TransactionStatus.PENDING,
      amount: '0.5',
      createdAt: new Date(Date.now() - 120_000),
    });
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      availableBalance: '1.0',
      lockedBalance: '0.5',
    });
    transactionRepository.transitionFromPending.mockResolvedValue(false);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    await worker.processPendingTransactions();
    randomSpy.mockRestore();

    expect(metricsService.incrementTransitionConflict).toHaveBeenCalled();
    expect(walletRepo.save).not.toHaveBeenCalled();
  });
});
