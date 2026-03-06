import dataSource from '../../../ormconfig';
import { TransactionEntity } from '../../domain/transaction/entities/transaction.entity';
import { Asset } from '../../domain/transaction/enums/asset.enum';
import { Network } from '../../domain/transaction/enums/network.enum';
import { TransactionStatus } from '../../domain/transaction/enums/transaction-status.enum';
import { TransactionType } from '../../domain/transaction/enums/transaction-type.enum';
import { WalletEntity } from '../../domain/wallet/entities/wallet.entity';

const BTC_WALLET_ID = '11111111-1111-1111-1111-111111111111';
const ETH_WALLET_ID = '22222222-2222-2222-2222-222222222222';
const USDT_WALLET_ID = '33333333-3333-3333-3333-333333333333';

async function seed(): Promise<void> {
  await dataSource.initialize();

  const walletRepo = dataSource.getRepository(WalletEntity);
  const txRepo = dataSource.getRepository(TransactionEntity);

  const existing = await walletRepo.findOne({
    where: { id: BTC_WALLET_ID },
  });
  if (existing) {
    await dataSource.destroy();
    return;
  }

  await walletRepo.save([
    walletRepo.create({
      id: BTC_WALLET_ID,
      ownerId: 'owner_user_1',
      asset: Asset.BTC,
      availableBalance: '1.500000000000000000',
      lockedBalance: '0',
    }),
    walletRepo.create({
      id: ETH_WALLET_ID,
      ownerId: 'owner_user_2',
      asset: Asset.ETH,
      availableBalance: '10.000000000000000000',
      lockedBalance: '0',
    }),
    walletRepo.create({
      id: USDT_WALLET_ID,
      ownerId: 'owner_user_3',
      asset: Asset.USDT,
      availableBalance: '5000.000000000000000000',
      lockedBalance: '0',
    }),
  ]);

  await txRepo.save([
    txRepo.create({
      walletId: BTC_WALLET_ID,
      type: TransactionType.DEPOSIT,
      asset: Asset.BTC,
      amount: '0.500000000000000000',
      toAddress: null,
      network: Network.BITCOIN,
      status: TransactionStatus.CONFIRMED,
      txHash: '0xseedbtc',
      idempotencyKey: null,
    }),
    txRepo.create({
      walletId: ETH_WALLET_ID,
      type: TransactionType.TRANSFER,
      asset: Asset.ETH,
      amount: '1.250000000000000000',
      toAddress: '0xabc123',
      network: Network.ETHEREUM,
      status: TransactionStatus.PENDING,
      txHash: null,
      idempotencyKey: null,
    }),
  ]);

  await dataSource.destroy();
}

void seed();
