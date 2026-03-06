import { MigrationInterface, QueryRunner } from 'typeorm';

export class StrengthenIdempotencyAndTransitionConstraints1741265100000
  implements MigrationInterface
{
  name = 'StrengthenIdempotencyAndTransitionConstraints1741265100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_idempotency_key_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."transactions_idempotency_key_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "transactions_wallet_type_idempotency_key_uidx" ON "transactions" ("wallet_id", "type", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "transactions_confirmed_status_requires_confirmed_at" CHECK ((status = 'confirmed' AND confirmed_at IS NOT NULL) OR (status <> 'confirmed' AND confirmed_at IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_confirmed_status_requires_confirmed_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."transactions_wallet_type_idempotency_key_uidx"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "transactions_idempotency_key_key" UNIQUE ("idempotency_key")`,
    );
  }
}
