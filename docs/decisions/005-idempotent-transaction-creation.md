# ADR 005: Database-backed idempotent creation

## Context

Double clicks, client retries, and concurrent requests can create duplicate financial records. Rate limiting cannot guarantee correctness.

## Decision

Require a UUID `Idempotency-Key` for create. Canonically hash validated semantic fields. In one serializable transaction, create the unique idempotency record and transaction, then link the resource. A repeated identical request returns the original; key reuse with a different hash returns 409.

## Alternatives considered

- Frontend button disabling: improves UX but cannot cover network retries or concurrency.
- Redis lock/key: makes correctness depend on optional cache availability.
- Description/date/amount duplicate heuristic: incorrectly rejects legitimate repeated purchases.

## Trade-offs

Records require retention cleanup and serialize a small critical section. Database uniqueness is still the simplest reliable arbiter at assignment scale.

