import { Column, Entity, OneToMany, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { Asset } from '../../transaction/enums/asset.enum';
import { TransactionEntity } from '../../transaction/entities/transaction.entity';

@Entity({ name: 'wallets' })
export class WalletEntity extends BaseEntity {
  @Column({ name: 'owner_id', type: 'varchar', length: 255 })
  ownerId: string;

  @Column({ type: 'enum', enum: Asset })
  asset: Asset;

  @Column({
    name: 'available_balance',
    type: 'numeric',
    precision: 36,
    scale: 18,
    transformer: {
      to: (value: string) => value,
      from: (value: string) => value,
    },
    default: '0',
  })
  availableBalance: string;

  @Column({
    name: 'locked_balance',
    type: 'numeric',
    precision: 36,
    scale: 18,
    transformer: {
      to: (value: string) => value,
      from: (value: string) => value,
    },
    default: '0',
  })
  lockedBalance: string;

  @VersionColumn({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => TransactionEntity, (tx) => tx.wallet)
  transactions: TransactionEntity[];
}
