import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/base.repository';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';

@Injectable()
export class TransactionRepository extends BaseRepository<TransactionEntity> {
  constructor(
    @InjectRepository(TransactionEntity)
    repository: Repository<TransactionEntity>,
  ) {
    super(repository);
  }

  async findByIdempotencyKey(
    walletId: string,
    idempotencyKey: string,
    type: TransactionType,
  ): Promise<TransactionEntity | null> {
    return this.repository.findOne({
      where: { walletId, idempotencyKey, type },
    });
  }

  async transitionFromPending(
    transactionId: string,
    nextStatus: TransactionStatus,
    manager: EntityManager,
    options?: { txHash?: string | null; confirmedAt?: Date | null },
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(TransactionEntity)
      .set({
        status: nextStatus,
        txHash: options?.txHash ?? null,
        confirmedAt: options?.confirmedAt ?? null,
        updatedAt: () => 'now()',
      })
      .where('id = :transactionId AND status = :pendingStatus', {
        transactionId,
        pendingStatus: TransactionStatus.PENDING,
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async createAndSave(
    transaction: Partial<TransactionEntity>,
    manager: EntityManager,
  ): Promise<TransactionEntity> {
    const repo = manager.getRepository(TransactionEntity);
    const entity = repo.create(transaction);
    return repo.save(entity);
  }

  async findPendingOlderThan(
    ageMs: number,
    limit: number,
  ): Promise<TransactionEntity[]> {
    const threshold = new Date(Date.now() - ageMs).toISOString();
    return this.repository
      .createQueryBuilder('tx')
      .where('tx.status = :status', { status: TransactionStatus.PENDING })
      .andWhere('tx.created_at <= :threshold', { threshold })
      .orderBy('tx.created_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  async listByWallet(
    walletId: string,
    filters: TransactionFilterDto,
  ): Promise<{ data: TransactionEntity[]; nextCursor: string | null }> {
    const take = filters.limit ?? 20;
    const qb = this.repository
      .createQueryBuilder('tx')
      .where('tx.wallet_id = :walletId', { walletId })
      .orderBy('tx.created_at', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .take(take + 1);

    if (filters.asset) {
      qb.andWhere('tx.asset = :asset', { asset: filters.asset });
    }
    if (filters.status) {
      qb.andWhere('tx.status = :status', { status: filters.status });
    }

    if (filters.cursor) {
      const cursor = this.decodeCursor(filters.cursor);
      qb.andWhere(
        '(tx.created_at < :cursorCreatedAt OR (tx.created_at = :cursorCreatedAt AND tx.id < :cursorId))',
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    }

    const rows = await qb.getMany();
    if (rows.length <= take) {
      return { data: rows, nextCursor: null };
    }

    const currentPage = rows.slice(0, take);
    const last = currentPage[currentPage.length - 1];
    const nextCursor = this.encodeCursor({
      createdAt: last.createdAt.toISOString(),
      id: last.id,
    });

    return {
      data: currentPage,
      nextCursor,
    };
  }
}
