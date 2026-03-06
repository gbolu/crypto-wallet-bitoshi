import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameWalletOwnerNameToOwnerId1741265000000 implements MigrationInterface {
  name = 'RenameWalletOwnerNameToOwnerId1741265000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" RENAME COLUMN "owner_name" TO "owner_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" RENAME COLUMN "owner_id" TO "owner_name"`,
    );
  }
}
