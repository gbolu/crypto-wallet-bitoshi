# Database Module

`src/database` contains schema evolution and seed data for local/test environments.

## Structure

- `migrations/`
  - `1741264800000-CreateWalletSchema.ts`
  - `1741264900000-AddWalletSafetyAndTransactionConfirmation.ts`
  - `1741265000000-RenameWalletOwnerNameToOwnerId.ts`
- `seeds/`
  - `seed.ts`

## Migrations

### `1741264800000-CreateWalletSchema.ts`

Initial schema migration:

- Enables `pgcrypto` extension for UUID generation.
- Creates enum types:
  - `wallets_asset_enum`
  - `transactions_type_enum`
  - `transactions_asset_enum`
  - `transactions_network_enum`
  - `transactions_status_enum`
- Creates `wallets` table with:
  - `id`
  - `owner_name`
  - `asset`
  - `available_balance`
  - `locked_balance`
  - timestamps
- Creates `transactions` table with:
  - FK `wallet_id -> wallets.id`
  - unique `idempotency_key`
  - transaction metadata columns
  - timestamps
- Adds index `transactions_wallet_id_created_at_idx` on (`wallet_id`, `created_at`).

### `1741264900000-AddWalletSafetyAndTransactionConfirmation.ts`

Safety and confirmation enhancements:

- Adds non-negative constraints:
  - `wallets_available_balance_non_negative`
  - `wallets_locked_balance_non_negative`
- Adds optimistic-version column on wallets:
  - `version int default 1`
- Adds `transactions.confirmed_at` timestamp.

### `1741265000000-RenameWalletOwnerNameToOwnerId.ts`

Ownership field rename:

- Renames wallet column:
  - `owner_name` -> `owner_id`

## Seed Data

`seeds/seed.ts` creates deterministic data:

- Wallets:
  - BTC wallet: `11111111-1111-1111-1111-111111111111`
  - ETH wallet: `22222222-2222-2222-2222-222222222222`
  - USDT wallet: `33333333-3333-3333-3333-333333333333`
- Transactions:
  - 1 confirmed BTC deposit
  - 1 pending ETH transfer

Seed script is idempotent: if BTC wallet exists, script exits without re-seeding.

## DataSource and CLI Integration

Root `ormconfig.ts` exports the TypeORM `DataSource` used by:

- TypeORM CLI migration commands
- seed script connection initialization

Configured entities:

- `WalletEntity`
- `TransactionEntity`

## Commands

From repository root:

```bash
pnpm run migration:generate
pnpm run migration:run
pnpm run migration:revert
pnpm run seed
```
