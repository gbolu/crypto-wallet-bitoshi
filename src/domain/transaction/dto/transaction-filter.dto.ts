import { IsEnum, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination-query.dto';
import { Asset } from '../enums/asset.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';

export class TransactionFilterDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(Asset)
  asset?: Asset;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
