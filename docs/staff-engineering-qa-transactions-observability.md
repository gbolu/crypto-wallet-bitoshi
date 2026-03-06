# Staff Engineering Q&A: Transactions and Observability

## 1) Double-Spend Prevention

### Scenario
Two withdrawal requests for the same wallet arrive at nearly the same time.

### How to prevent overdrawing
- Perform the debit as a single atomic database operation with a balance guard, e.g. update only when `available_balance >= amount`.
- Execute balance movement and transaction record creation in one DB transaction so they either both succeed or both fail.
- Use row-level locking (or an equivalent atomic conditional update) on the wallet row during debit.
- Add database constraints to prevent invalid states (for example, non-negative balances).
- Require idempotency keys on withdrawal requests to prevent duplicate execution from retries.

### Why this works
The key is moving correctness to the database boundary. Under concurrency, only one request can successfully satisfy the spend condition when funds are limited.

---

## 2) Transaction State Transitions

### Goal
Safely transition a transaction from `pending` to `confirmed`.

### Safe approach
- Define an explicit state machine that allows only valid transitions (`pending -> confirmed`, `pending -> failed`) and rejects everything else.
- Read and update the transaction inside a DB transaction with row lock (`SELECT ... FOR UPDATE`-style behavior).
- Verify current state is still `pending` right before write; if not, treat as a no-op or conflict.
- Write confirmation metadata atomically with the state update (e.g. `confirmed_at`, block height/hash, settlement reference).
- Keep the operation idempotent so repeated confirmations do not create side effects.

### Why this works
You prevent illegal transitions, avoid race conditions between workers, and preserve a durable audit trail of when and why confirmation happened.

---

## 3) Observability in a Crypto Backend

### Critical logs
- Request logs: method, route, status, latency, correlation/request ID, actor or wallet identifier.
- Business-event logs: withdrawal requested, queued, broadcast, confirmed, failed, reversed.
- State transition logs: old state, new state, reason, worker/job ID, transaction ID.
- Error logs: external provider failures, timeout/retry context, validation failures, DB conflicts.
- Security logs: auth failures, suspicious withdrawal patterns, key-management or signing anomalies.

### Critical metrics
- Throughput: withdrawals created, broadcasts sent, confirmations per minute.
- Reliability: success rate, failure rate by reason, retry counts, dead-letter queue depth.
- Latency: API p95/p99, queue wait time, confirmation time from submit to settle.
- Consistency/safety: duplicate request detections, idempotency replay count, lock/contention conflicts.
- Operational health: worker lag, provider RPC error rate, DB pool saturation, circuit-breaker open rate.

### What matters most
In financial systems, observability is not just for debugging. It is your early-warning and audit mechanism for correctness, fraud detection, and incident response.
