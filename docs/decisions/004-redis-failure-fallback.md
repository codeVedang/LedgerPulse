# ADR 004: Redis is an optional accelerator

## Context

A cache outage must not turn into a ledger outage.

## Decision

Every cache operation catches Redis errors, logs only operation/key metadata with the request ID, opens a short local circuit after repeated failures, and returns a cache miss. PostgreSQL calculation remains the source of truth.

## Alternatives considered

- Fail the request: rejected because cache availability is not a correctness dependency.
- Silently ignore failures: rejected because operators lose failure evidence.
- Retry heavily in the request: rejected because it amplifies latency and Redis load during an outage.

## Trade-offs

Fallback increases database load during an outage. Aggregate queries and indexes must therefore be acceptable without Redis; the cache is not a capacity mask.

