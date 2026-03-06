import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateWalletSchema1741264800000 implements MigrationInterface {
  name = 'CreateWalletSchema1741264800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "public"."wallets_asset_enum" AS ENUM('BTC', 'ETH', 'USDT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('deposit', 'withdrawal', 'transfer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_asset_enum" AS ENUM('BTC', 'ETH', 'USDT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_network_enum" AS ENUM('Bitcoin', 'Ethereum')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'confirmed', 'failed')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'owner_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'asset',
            type: 'wallets_asset_enum',
          },
          {
            name: 'available_balance',
            type: 'numeric',
            precision: 36,
            scale: 18,
            default: "'0'",
          },
          {
            name: 'locked_balance',
            type: 'numeric',
            precision: 36,
            scale: 18,
            default: "'0'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'wallet_id',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'transactions_type_enum',
          },
          {
            name: 'asset',
            type: 'transactions_asset_enum',
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 36,
            scale: 18,
          },
          {
            name: 'to_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'network',
            type: 'transactions_network_enum',
          },
          {
            name: 'status',
            type: 'transactions_status_enum',
          },
          {
            name: 'tx_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'transactions_idempotency_key_key',
            columnNames: ['idempotency_key'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'transactions',
      new TableForeignKey({
        name: 'transactions_wallet_id_fkey',
        columnNames: ['wallet_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'wallets',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'transactions_wallet_id_created_at_idx',
        columnNames: ['wallet_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'transactions',
      'transactions_wallet_id_created_at_idx',
    );
    await queryRunner.dropForeignKey(
      'transactions',
      'transactions_wallet_id_fkey',
    );

    await queryRunner.dropTable('transactions');
    await queryRunner.dropTable('wallets');

    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_network_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_asset_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."wallets_asset_enum"`);
  }
}
