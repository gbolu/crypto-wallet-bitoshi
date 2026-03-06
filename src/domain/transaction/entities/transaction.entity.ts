import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { WalletEntity } from '../../wallet/entities/wallet.entity';
import { Asset } from '../enums/asset.enum';
import { Network } from '../enums/network.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';

@Entity({ name: 'transactions' })
@Index(
  'transactions_wallet_type_idempotency_key_uidx',
  ['walletId', 'type', 'idempotencyKey'],
  {
    unique: true,
    where: '"idempotency_key" IS NOT NULL',
  },
)
export class TransactionEntity extends BaseEntity {
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @ManyToOne(() => WalletEntity, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: WalletEntity;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: Asset })
  asset: Asset;

  @Column({
    type: 'numeric',
    precision: 36,
    scale: 18,
    transformer: {
      to: (value: string) => value,
      from: (value: string) => value,
    },
  })
  amount: string;

  @Column({ name: 'to_address', type: 'varchar', length: 255, nullable: true })
  toAddress: string | null;

  @Column({ type: 'enum', enum: Network })
  network: Network;

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @Column({ name: 'tx_hash', type: 'varchar', length: 255, nullable: true })
  txHash: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey: string | null;
}
