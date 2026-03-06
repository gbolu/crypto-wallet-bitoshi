import { Asset } from '../../transaction/enums/asset.enum';

export interface WalletResponseDto {
  id: string;
  ownerId: string;
  asset: Asset;
  availableBalance: string;
  lockedBalance: string;
}
