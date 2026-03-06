import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletModule } from '../wallet/wallet.module';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionRepository } from './repositories/transaction.repository';
import { TransactionService } from './services/transaction.service';
import { TransactionStatusWorker } from './workers/transaction-status.worker';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity]), WalletModule],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    TransactionRepository,
    TransactionStatusWorker,
  ],
  exports: [TransactionRepository],
})
export class TransactionModule {}
