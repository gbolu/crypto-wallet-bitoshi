import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletSafetyAndTransactionConfirmation1741264900000 implements MigrationInterface {
  name = 'AddWalletSafetyAndTransactionConfirmation1741264900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "wallets_available_balance_non_negative" CHECK (available_balance >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "wallets_locked_balance_non_negative" CHECK (locked_balance >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "version" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "confirmed_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "confirmed_at"`,
    );
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "version"`);
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "wallets_locked_balance_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "wallets_available_balance_non_negative"`,
    );
  }
}
