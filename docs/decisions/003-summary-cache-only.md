# ADR 003: Cache aggregates only

## Context

Dashboard aggregates repeat and become increasingly expensive. Transaction lists have many filter/sort/page combinations and change on every mutation.

## Decision

Cache versioned summary and pulse results for 60 seconds. Track a small per-user set of aggregate keys and delete it after transaction create/update/delete. Query transaction lists directly from indexed PostgreSQL.

## Alternatives considered

- Cache all GET requests: creates a disproportionate invalidation matrix and stale-list risk.
- No cache: simplest, but fails to demonstrate the requested deliberate Redis integration.
- Redis key scan: easy locally but blocks or degrades shared production Redis instances.

## Trade-offs

The key registry adds small Redis bookkeeping. Cache invalidation failure can briefly serve data until TTL, so mutations attempt invalidation and log failure while preserving core ledger availability.

