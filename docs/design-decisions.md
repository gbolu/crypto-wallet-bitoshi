# Crypto Wallet Hardening

This document answers the three architecture questions and maps them to concrete implementations in this codebase.

## 1) Double-Spend Prevention

### Problem
Two withdrawal requests can arrive at the same time and attempt to spend the same available balance.

### Implemented controls

1. Atomic wallet debit with in-query balance guard
   - `WalletRepository.debitForWithdrawal(...)` performs one SQL `UPDATE` that:
     - subtracts from `available_balance`
     - adds to `locked_balance`
     - only succeeds when `available_balance >= amount`
   - File: `src/domain/wallet/repositories/wallet.repository.ts`

2. Transaction boundary on withdrawal creation
   - Withdrawal balance movement and transaction row creation happen inside the same DB transaction.
   - File: `src/domain/transaction/services/transaction.service.ts`

3. Database-level non-negative constraints
   - Added DB constraints so invalid negative balances are rejected even if app logic regresses.
   - Migration: `src/database/migrations/1741264900000-AddWalletSafetyAndTransactionConfirmation.ts`

4. Optimistic versioning
   - Added `@VersionColumn()` to wallet entity.
   - File: `src/domain/wallet/entities/wallet.entity.ts`

5. Scoped idempotency uniqueness
   - Idempotency keys are now unique per `(wallet_id, type, idempotency_key)` instead of globally.
   - This prevents cross-wallet/cross-operation collisions while preserving safe replay semantics.
   - Migration: `src/database/migrations/1741265100000-StrengthenIdempotencyAndTransitionConstraints.ts`

### Why this prevents overdrawing
The critical deduction is now atomic and conditional in SQL. Under concurrency, only requests that satisfy the balance predicate can update the row.

---

## 2) Transaction State Transitions

### Problem
State changes like `pending -> confirmed` must be valid and irreversible from terminal states.

### Implemented controls

1. Explicit state machine
   - Added `TransactionStateMachine.transition(current, next)`.
   - Allowed:
     - `pending -> confirmed`
     - `pending -> failed`
   - Disallowed:
     - any transition from `confirmed` or `failed`
   - File: `src/domain/transaction/guards/transaction-state-machine.ts`

2. Worker enforcement
   - Worker computes candidate status and validates transition via state machine before saving.
   - File: `src/domain/transaction/workers/transaction-status.worker.ts`

3. Finalization timestamp
   - Added `transactions.confirmed_at` and mapped it to entity field `confirmedAt`.
   - Set when transaction is confirmed.
   - Files:
     - `src/domain/transaction/entities/transaction.entity.ts`
     - `src/database/migrations/1741264900000-AddWalletSafetyAndTransactionConfirmation.ts`

4. Compare-and-set state updates
   - Transition updates now use `WHERE status = 'pending'` compare-and-set logic to avoid stale rewrites.
   - File: `src/domain/transaction/repositories/transaction.repository.ts`

5. DB status/timestamp consistency constraint
   - Added a DB check enforcing `confirmed` transactions must have `confirmed_at`, and non-`confirmed` must not.
   - Migration: `src/database/migrations/1741265100000-StrengthenIdempotencyAndTransitionConstraints.ts`

### Why this is safe
All transition writes happen under row-level lock + transaction. The state machine prevents illegal transitions and terminal-state rewrites.

---

## 3) Observability (Logs and Metrics)

### Critical logs implemented

1. Structured JSON application logs
   - Added `StructuredLoggerService` to emit JSON logs with timestamp/level/context/message and metadata.
   - File: `src/common/logger/structured-logger.service.ts`

2. HTTP request lifecycle logs
   - Logging interceptor now logs:
     - method, URL, status code
     - elapsed time
     - correlation ID
     - wallet ID (when present)
     - request body size
   - Errors are also logged with structured error payload.
   - File: `src/common/interceptors/logging.interceptor.ts`

3. Business-event logs
   - Deposit created
   - Deposit idempotent replay
   - Withdrawal created
   - Idempotent replay
   - Transaction state transition
   - Transaction processing failure
   - Files:
     - `src/domain/transaction/services/transaction.service.ts`
     - `src/domain/transaction/workers/transaction-status.worker.ts`

### Critical metrics implemented

`MetricsService` now tracks:
- `depositsCreated`
- `withdrawalsCreated`
- transition counts (`confirmed`, `failed`)
- error counts grouped by type
- idempotent replay count by operation type
- DB conflict counts by operation
- transition conflict counts
- HTTP request latency histogram
- confirmation latency histogram
- worker batch duration histogram
- pending transaction backlog gauge

Files:
- `src/common/metrics/metrics.service.ts`
- `src/app.controller.ts` (`GET /metrics`)

### Health observability

- Added DB health check endpoint using Terminus:
  - `GET /health/db`
- File: `src/common/health/health.controller.ts`

---

## Endpoint summary

- `GET /health` (existing app health)
- `GET /health/db` (database health probe)
- `GET /metrics` (operational counters)
- `POST /wallets/:walletId/deposits` (idempotent immediate wallet funding)
- `POST /wallets/:walletId/withdrawals` (idempotent pending withdrawal)
