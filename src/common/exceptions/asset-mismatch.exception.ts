import { DomainException } from './domain.exception';

export class AssetMismatchException extends DomainException {
  constructor(walletId: string, walletAsset: string, requestedAsset: string) {
    super(
      'ASSET_MISMATCH',
      `Wallet ${walletId} holds ${walletAsset}, not ${requestedAsset}`,
    );
  }
}
