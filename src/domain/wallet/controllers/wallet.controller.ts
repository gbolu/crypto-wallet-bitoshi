import { Controller, Get, Param } from '@nestjs/common';
import { WalletResponseDto } from '../dto/wallet-response.dto';
import { WalletService } from '../services/wallet.service';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':walletId')
  getWallet(@Param('walletId') walletId: string): Promise<WalletResponseDto> {
    return this.walletService.getWallet(walletId);
  }
}
