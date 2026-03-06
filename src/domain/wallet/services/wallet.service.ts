import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions/entity-not-found.exception';
import { WalletResponseDto } from '../dto/wallet-response.dto';
import { WalletRepository } from '../repositories/wallet.repository';

@Injectable()
export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async getWallet(walletId: string): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw new EntityNotFoundException('Wallet', walletId);
    }

    return {
      id: wallet.id,
      ownerId: wallet.ownerId,
      asset: wallet.asset,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
    };
  }
}
