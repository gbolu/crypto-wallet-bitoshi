import { INestApplication, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransactionController } from '../../src/domain/transaction/controllers/transaction.controller';
import { Asset } from '../../src/domain/transaction/enums/asset.enum';
import { TransactionStatus } from '../../src/domain/transaction/enums/transaction-status.enum';
import { TransactionType } from '../../src/domain/transaction/enums/transaction-type.enum';
import { TransactionService } from '../../src/domain/transaction/services/transaction.service';

describe('Create Withdrawal (e2e)', () => {
  let app: INestApplication;
  const createWithdrawalMock = jest.fn<
    Promise<{ transaction: unknown; isReplay: boolean }>,
    [
      string,
      { asset: Asset; amount: string; toAddress: string },
      string | undefined,
    ]
  >();

  const getServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as Parameters<typeof request>[0];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: {
            createWithdrawal: createWithdrawalMock,
            getWalletTransactions: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    createWithdrawalMock.mockReset();
    await app.close();
  });

  it('returns 201 for new withdrawal', async () => {
    createWithdrawalMock.mockResolvedValue({
      isReplay: false,
      transaction: {
        id: 'tx_1',
        walletId: 'wallet_1',
        type: TransactionType.WITHDRAWAL,
        asset: Asset.BTC,
        amount: '0.010000000000000000',
        network: 'Bitcoin',
        status: TransactionStatus.PENDING,
        txHash: null,
        createdAt: new Date().toISOString(),
      },
    });

    const response = await request(getServer())
      .post('/wallets/wallet_1/withdrawals')
      .set('Idempotency-Key', 'idem-123')
      .send({
        asset: Asset.BTC,
        amount: '0.01',
        toAddress: 'bc1qexample',
      })
      .expect(201);

    const payload = response.body as {
      data: { id: string; status: TransactionStatus };
    };
    expect(payload.data.id).toBe('tx_1');
    expect(payload.data.status).toBe(TransactionStatus.PENDING);
  });

  it('returns 200 for idempotent replay', async () => {
    createWithdrawalMock.mockResolvedValue({
      isReplay: true,
      transaction: {
        id: 'tx_1',
        walletId: 'wallet_1',
      },
    });

    await request(getServer())
      .post('/wallets/wallet_1/withdrawals')
      .set('Idempotency-Key', 'idem-123')
      .send({
        asset: Asset.BTC,
        amount: '0.01',
        toAddress: 'bc1qexample',
      })
      .expect(200);
  });

  it('returns 422 when balance is insufficient', async () => {
    createWithdrawalMock.mockRejectedValue(
      new UnprocessableEntityException('Insufficient balance'),
    );

    await request(getServer())
      .post('/wallets/wallet_1/withdrawals')
      .set('Idempotency-Key', 'idem-124')
      .send({
        asset: Asset.BTC,
        amount: '10.00',
        toAddress: 'bc1qexample',
      })
      .expect(422);
  });
});
