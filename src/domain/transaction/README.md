# Transaction Domain Module

`src/domain/transaction` owns transaction querying, deposit/withdrawal creation, and background status transitions.

## Core Responsibilities

- Expose wallet transaction APIs.
- Validate and create deposits with idempotency.
- Validate and create withdrawals with idempotency.
- Manage pending-to-final status transitions through a worker.

## Files and Responsibilities

### `transaction.module.ts`

- Registers `TransactionEntity` with TypeORM.
- Imports `WalletModule` to use `WalletRepository`.
- Wires:
  - `TransactionController`
  - `TransactionService`
  - `TransactionRepository`
  - `TransactionStatusWorker`

### `enums/`

- `asset.enum.ts`: `BTC`, `ETH`, `USDT`
- `network.enum.ts`: `Bitcoin`, `Ethereum`
- `transaction-type.enum.ts`: `deposit`, `withdrawal`, `transfer`
- `transaction-status.enum.ts`: `pending`, `confirmed`, `failed`

### `entities/transaction.entity.ts`

`TransactionEntity` includes:

- `walletId` FK to wallets
- `type`, `asset`, `amount`, `toAddress`, `network`, `status`
- `txHash` (nullable)
- `confirmedAt` (nullable timestamptz)
- `idempotencyKey` (nullable, unique)
- many-to-one relation to `WalletEntity`

### `dto/`

- `create-deposit.dto.ts`
  - validates asset enum and positive decimal amount string
- `create-withdrawal.dto.ts`
  - validates asset enum, decimal amount string, and destination address
- `transaction-filter.dto.ts`
  - extends cursor pagination query
  - optional `asset` and `status` filters
- `transaction-response.dto.ts`
  - includes `confirmedAt` and other transaction response fields

### `repositories/transaction.repository.ts`

Extends `BaseRepository` and provides:

- `findByIdempotencyKey(walletId, idempotencyKey)`
- `createAndSave(partial, manager)` for transactional inserts
- `findPendingOlderThan(ageMs, limit)` for worker batch pulls
- `listByWallet(walletId, filters)` with cursor pagination:
  - ordered by `created_at DESC, id DESC`
  - filters by `asset` and `status`
  - uses `{ createdAt, id }` encoded cursor from base repository

### `guards/transaction-state-machine.ts`

- Guards allowed status transitions:
  - `pending -> confirmed`
  - `pending -> failed`
- Prevents invalid transitions from terminal states.

### `services/transaction.service.ts`

Key methods:

- `getWalletTransactions(walletId, filters)`
  - ensures wallet exists
  - returns paginated transaction data

- `createDeposit(walletId, dto, idempotencyKey)`
  - validates idempotency key and positive amount
  - validates wallet exists and asset matches wallet
  - checks existing transaction by idempotency key
  - executes DB transaction:
    - atomically credits wallet (`creditForDeposit`)
    - creates confirmed deposit transaction
  - handles unique-constraint races (idempotent replay)
  - emits structured events and updates metrics
  - raises domain exceptions (`InvalidInputException`, `EntityNotFoundException`, `AssetMismatchException`)

- `createWithdrawal(walletId, dto, idempotencyKey)`
  - validates idempotency key and positive amount
  - validates wallet exists and asset matches wallet
  - checks existing transaction by idempotency key
  - executes DB transaction:
    - atomically debits wallet (`debitForWithdrawal`)
    - creates pending withdrawal transaction
  - handles unique-constraint races (idempotent replay)
  - emits structured events and updates metrics
  - raises domain exceptions (`InvalidInputException`, `EntityNotFoundException`, `AssetMismatchException`, `InsufficientBalanceException`)

### `controllers/transaction.controller.ts`

Routes under `wallets/:walletId`:

- `GET /transactions`
  - returns `{ data, nextCursor }`
- `POST /withdrawals`
  - returns `201` for new create
  - returns `200` for idempotent replay
- `POST /deposits`
  - returns `201` for new create
  - returns `200` for idempotent replay

### `workers/transaction-status.worker.ts`

Cron job every 30 seconds:

- fetches pending transactions older than 60 seconds
- for each candidate, runs DB transaction with row locks
- chooses next status (`confirmed` 80%, `failed` 20%)
- applies state transition via `TransactionStateMachine`
- updates balances:
  - confirmed: release locked balance
  - failed: release locked balance and restore available balance
- updates `txHash`/`confirmedAt`
- emits structured events and updates metrics
- captures and records processing errors without crashing batch loop

## Cross-Domain Dependencies

- Uses `WalletRepository` from wallet domain for wallet checks and balance mutation.
- Uses common-layer services for:
  - structured OTel logging (`OtelLoggerService`)
  - in-memory counters (`MetricsService`)
  - amount safety (`AmountUtil`)
  - domain exception mapping via global exception filter.
