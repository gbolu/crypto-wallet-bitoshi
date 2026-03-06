# Wallet Domain Module

`src/domain/wallet` owns wallet retrieval and wallet-balance state.

## Domain Model

- A wallet is **single-asset** (`BTC`, `ETH`, or `USDT`).
- Each wallet stores its balances directly:
  - `availableBalance` (spendable)
  - `lockedBalance` (reserved for pending withdrawals)
- Wallets are linked to many transactions.

## Files and Responsibilities

### `wallet.module.ts`

- Registers `WalletEntity` with TypeORM.
- Wires `WalletController`, `WalletService`, and `WalletRepository`.
- Exports `WalletRepository` for use in `TransactionModule`.

### `entities/wallet.entity.ts`

Defines `WalletEntity` with:

- `ownerId`
- `asset` (enum)
- `availableBalance` (`numeric(36,18)` as string transformer)
- `lockedBalance` (`numeric(36,18)` as string transformer)
- `version` (`@VersionColumn`) for optimistic-version tracking
- `transactions` relation (`@OneToMany`)

### `repositories/wallet.repository.ts`

Extends `BaseRepository<WalletEntity>` and adds:

- `findByIdForUpdate(walletId, manager)`
  - row-level pessimistic lock for transactional workflows
- `debitForWithdrawal(walletId, asset, amount, manager)`
  - atomic SQL update that:
    - decrements `available_balance`
    - increments `locked_balance`
    - enforces `available_balance >= amount` in the same statement
  - returns `true` if update affected a row, otherwise `false`.
- `creditForDeposit(walletId, asset, amount, manager)`
  - atomic SQL update that increments `available_balance`
  - enforces `id` and `asset` match in the same statement
  - returns `true` if update affected a row, otherwise `false`.

### `services/wallet.service.ts`

- `getWallet(walletId)`
  - finds wallet by ID
  - throws `EntityNotFoundException` if missing
  - returns flattened `WalletResponseDto`.

### `controllers/wallet.controller.ts`

- `GET /wallets/:walletId`
  - delegates to `WalletService.getWallet`.

### `dto/wallet-response.dto.ts`

Response contract:

- `id`
- `ownerId`
- `asset`
- `availableBalance`
- `lockedBalance`

## Interaction with Transaction Domain

- Deposit and withdrawal creation in `TransactionService` relies on this module for:
  - wallet existence checks
  - asset compatibility checks
  - atomic balance movement using `creditForDeposit` and `debitForWithdrawal`.
