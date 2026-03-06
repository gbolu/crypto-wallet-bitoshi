import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './controllers/wallet.controller';
import { WalletEntity } from './entities/wallet.entity';
import { WalletRepository } from './repositories/wallet.repository';
import { WalletService } from './services/wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity])],
  controllers: [WalletController],
  providers: [WalletService, WalletRepository],
  exports: [WalletRepository],
})
export class WalletModule {}
