import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Asset } from '../enums/asset.enum';

export class CreateWithdrawalDto {
  @IsEnum(Asset)
  asset: Asset;

  @IsString()
  @Matches(/^(0|[1-9]\d{0,17})(\.\d{1,18})?$/, {
    message:
      'amount must be a decimal string with up to 18 integer and 18 fractional digits',
  })
  amount: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;
}
