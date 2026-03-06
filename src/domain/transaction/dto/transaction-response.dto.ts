import { Asset } from '../enums/asset.enum';
import { Network } from '../enums/network.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';

export interface TransactionResponseDto {
  id: string;
  walletId: string;
  type: TransactionType;
  asset: Asset;
  amount: string;
  network: Network;
  status: TransactionStatus;
  txHash: string | null;
  confirmedAt: string | null;
  createdAt: string;
}
