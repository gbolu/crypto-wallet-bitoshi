import { Body, Controller, Post } from '@nestjs/common';
import { AssetMismatchException } from '../../exceptions/asset-mismatch.exception';
import { EntityNotFoundException } from '../../exceptions/entity-not-found.exception';
import { InsufficientBalanceException } from '../../exceptions/insufficient-balance.exception';
import { InvalidInputException } from '../../exceptions/invalid-input.exception';
import { MockFailureDto } from '../dto/mock-failure.dto';
import { MockFailureType } from '../dto/mock-failure-type.enum';

@Controller('mock')
export class MockFailureController {
  @Post('failure')
  triggerFailure(@Body() body: MockFailureDto): never {
    switch (body.errorType) {
      case MockFailureType.INVALID_INPUT:
        throw new InvalidInputException('Mock invalid input failure');
      case MockFailureType.ENTITY_NOT_FOUND:
        throw new EntityNotFoundException('Wallet', 'mock-wallet');
      case MockFailureType.INSUFFICIENT_BALANCE:
        throw new InsufficientBalanceException();
      case MockFailureType.ASSET_MISMATCH:
        throw new AssetMismatchException('mock-wallet', 'BTC', 'ETH');
      case MockFailureType.INTERNAL:
      default:
        throw new Error('Mock internal failure');
    }
  }
}
