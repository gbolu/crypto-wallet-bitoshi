import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/base.repository';
import { Asset } from '../../transaction/enums/asset.enum';
import { WalletEntity } from '../entities/wallet.entity';

@Injectable()
export class WalletRepository extends BaseRepository<WalletEntity> {
  constructor(
    @InjectRepository(WalletEntity)
    repository: Repository<WalletEntity>,
  ) {
    super(repository);
  }

  async findByIdForUpdate(
    walletId: string,
    manager: EntityManager,
  ): Promise<WalletEntity | null> {
    return manager.getRepository(WalletEntity).findOne({
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async debitForWithdrawal(
    walletId: string,
    asset: Asset,
    amount: string,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(WalletEntity)
      .set({
        availableBalance: () => `available_balance - CAST(:amount AS numeric)`,
        lockedBalance: () => `locked_balance + CAST(:amount AS numeric)`,
      })
      .where(
        `id = :walletId
         AND asset = :asset
         AND available_balance >= CAST(:amount AS numeric)`,
        { walletId, asset, amount },
      )
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async creditForDeposit(
    walletId: string,
    asset: Asset,
    amount: string,
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(WalletEntity)
      .set({
        availableBalance: () => `available_balance + CAST(:amount AS numeric)`,
      })
      .where(`id = :walletId AND asset = :asset`, { walletId, asset, amount })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
