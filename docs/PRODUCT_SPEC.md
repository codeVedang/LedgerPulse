# LedgerPulse product specification

## Product promise

LedgerPulse is a single-user, production-minded mini-ledger that answers three questions:

1. What changed in my money this month?
2. Is this transaction unlike my established behaviour, and why?
3. What would change if I recorded a transaction now?

It deliberately does not give investment advice, label transactions as fraud, or use an LLM to manufacture certainty. Its differentiator is an explainable behavioural baseline built from the ledger itself.

## Assignment scope

### In scope

- Income and expense transaction CRUD, filters, sorting, and pagination.
- Seeded, controlled categories with category deactivation instead of destructive deletion.
- Deterministic Behaviour Anomaly Score, confidence, explanations, and expected ranges.
- Non-persisting what-if preview that calls the same evaluation service used by creation.
- Current-month summary and explainable Financial Pulse.
- Behaviour Pulse Timeline focused on anomaly intensity.
- Domain-event-driven in-app notifications with pluggable channels.
- Idempotent transaction creation.
- Summary/pulse caching with graceful Redis failure.
- Honest single demo-user mode.

### Explicitly out of scope

- Authentication and multi-tenant authorization UI.
- Bank feeds, reconciliation, budgets, exchange-rate conversion, fraud detection, or financial advice.
- Email delivery. The notification interface makes this an incremental adapter, not a controller rewrite.
- Recurring-transaction prediction. It adds modelling claims without improving the core assignment signal.

## Primary user journey

1. The user opens the dashboard and sees a current-month financial pulse with component contributions.
2. The user opens Add transaction and enters amount, type, category, date, and an optional description.
3. The user chooses **Preview impact**. The API evaluates a dry run and returns before/after metrics plus a behaviour analysis without writing data or emitting notifications.
4. The user edits or confirms. Creation uses an idempotency key, persists the transaction and its analysis atomically, invalidates aggregates, and publishes domain events after commit.
5. A materially anomalous transaction appears in the timeline and creates an in-app notification. Its detail view explains the exact contributing rules and evidence.

## Domain rules

- Amounts must be strictly positive. Direction is represented only by `INCOME` or `EXPENSE`; negative amounts are rejected, not silently normalized.
- The assignment supports INR only. Unsupported currencies return an explicit validation error; no fake conversion is performed.
- Amounts have at most two fractional digits and an upper bound of `999999999999.99`.
- Transaction date must be a valid ISO-8601 instant and cannot be more than five minutes in the future. The tolerance prevents harmless device-clock skew while rejecting future ledger entries.
- Description is optional, trimmed, and limited to 240 characters.
- Categories have a type. An expense cannot be assigned to an income category and vice versa.
- Inactive categories remain attached to history but cannot receive new transactions. Existing transactions can be reassigned only to an active category of the same type.
- Creation requires a UUID idempotency key. The same user/key returns the original resource; reuse with a different payload returns `409 Conflict`.
- Preview never reserves an idempotency key, writes a transaction, invalidates a cache, or emits an event.

## Empty and insufficient-data states

- An empty ledger produces zero financial totals and a neutral, explicitly labelled Financial Pulse baseline rather than a fabricated positive assessment.
- Behaviour scoring returns `LOW` confidence until the minimum evidence rules are met.
- Low-confidence scores may expose early signals in the transaction detail, but cannot create a high-anomaly alert.
- Expected behaviour is omitted for dimensions without enough observations.

## Success criteria

- A reviewer can discover the unique behaviour analysis within the first dashboard viewport.
- Every score displayed has an adjacent explanation or a discoverable calculation breakdown.
- Repeated submissions do not duplicate a transaction.
- Redis can be stopped without breaking ledger reads or writes.
- Financial arithmetic never passes through JavaScript binary floating point.
- Unit tests demonstrate the statistical and failure-mode boundaries, not just happy-path controllers.

