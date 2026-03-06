# Staff Engineering Q&A

## 1) When would you use a message queue instead of a synchronous API call?

Use a message queue when reliability, decoupling, and throughput matter more than immediate response.

- Choose a synchronous API call when the caller needs an immediate result in the same request lifecycle (for example, login, balance lookup, validation checks).
- Choose a queue when work is slow, retry-prone, or handled by another service boundary (for example, blockchain broadcast, webhook fan-out, settlement reconciliation).
- Queues absorb traffic spikes and protect downstream systems from overload by buffering work.
- Queues allow at-least-once delivery with retries and dead-letter handling, but that means consumers must be idempotent.
- A common production pattern is sync for command acceptance (`202 Accepted`) and async for actual execution and completion events.

## 2) Explain idempotency and why it’s critical in payment or crypto systems.

Idempotency means processing the same request multiple times produces the same final state as processing it once.

- In payment/crypto flows, retries are normal (client retries, network retries, worker restarts, provider timeouts).
- Without idempotency, retries can create duplicate withdrawals, duplicate transfers, or double ledger movements.
- Implement with a client-supplied idempotency key plus a server-side uniqueness guarantee scoped by operation and actor.
- Persist the first successful result and return that same result for repeated requests with the same key.
- Combine idempotency with atomic transactions and uniqueness constraints so correctness holds even under concurrency.

In short: idempotency is a core financial safety control, not just an API convenience.

## 3) What problems can arise if you process financial amounts as floating-point numbers?

Floating-point numbers cannot exactly represent many decimal values, which introduces precision drift.

- Values like `0.1` and `0.01` are often approximations in binary floating-point.
- Repeated arithmetic can accumulate rounding error, causing balances to drift by small but unacceptable amounts.
- Equality checks and reconciliation logic become unreliable (`expected != actual` by tiny fractions).
- Different languages, runtimes, or serialization paths may round differently, creating cross-system mismatches.
- In trading and settlement, tiny precision errors can become material over high volume.

Use fixed-precision representations instead: integer minor units (for fiat) or decimal/big-number types with explicit scale and deterministic rounding rules.

## 4) What’s the difference between optimistic and pessimistic locking, and where would you use each?

Both manage concurrent writes, but they optimize for different contention patterns.

- Optimistic locking assumes conflicts are rare. You read data with a version, then update only if the version is unchanged.
- Pessimistic locking assumes conflicts are likely. You lock the row/resource first, so other writers must wait.
- Optimistic locking gives higher throughput and lower blocking under low contention, but conflicting updates must retry.
- Pessimistic locking reduces race risk in hot paths but can increase latency and lock contention.

Where to use each in financial systems:
- Optimistic: profile updates, low-contention metadata edits, back-office settings.
- Pessimistic (or atomic conditional SQL updates): high-contention balance mutations, withdrawal reservation, and state transitions where double-processing is unacceptable.

A practical approach is to default to optimistic where safe, and use pessimistic/atomic guarded writes for money movement paths.
