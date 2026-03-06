import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateDepositDto } from '../dto/create-deposit.dto';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { TransactionService } from '../services/transaction.service';

@Controller('wallets/:walletId')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('transactions')
  async getTransactions(
    @Param('walletId') walletId: string,
    @Query() query: TransactionFilterDto,
  ): Promise<{ data: unknown[]; nextCursor: string | null }> {
    return this.transactionService.getWalletTransactions(walletId, query);
  }

  @Post('withdrawals')
  async createWithdrawal(
    @Param('walletId') walletId: string,
    @Body() body: CreateWithdrawalDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: unknown }> {
    const result = await this.transactionService.createWithdrawal(
      walletId,
      body,
      idempotencyKey,
    );

    response.status(result.isReplay ? 200 : 201);
    return { data: result.transaction };
  }

  @Post('deposits')
  async createDeposit(
    @Param('walletId') walletId: string,
    @Body() body: CreateDepositDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: unknown }> {
    const result = await this.transactionService.createDeposit(
      walletId,
      body,
      idempotencyKey,
    );

    response.status(result.isReplay ? 200 : 201);
    return { data: result.transaction };
  }
}
