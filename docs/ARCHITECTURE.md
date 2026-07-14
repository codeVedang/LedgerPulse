# LedgerPulse architecture

## System shape

```text
Browser / Next.js
        |
        | REST + X-Request-Id + Idempotency-Key
        v
NestJS controllers (transport only)
        |
        v
Application services
  TransactionService ----> TransactionEvaluator (shared by preview + create)
  LedgerService ----------> FinancialCalculator / PulseCalculator
        |                         |
        |                         +--> BehaviourFingerprintEngine (pure domain)
        v
Prisma repositories / PostgreSQL
        |
        +--> AggregateCache (Redis optional, PostgreSQL fallback)
        +--> DomainEventBus --> NotificationService --> NotificationChannel[]
                                                     --> InApp channel
                                                     --> Console channel (development)
```

## Monorepo

```text
apps/
  api/       NestJS HTTP application and infrastructure adapters
  web/       Next.js App Router application
packages/
  domain/    framework-free Decimal calculations, anomaly and pulse engines
  contracts/ shared response and request shapes without persistence concerns
docs/        specifications, ADRs, journal, and review
```

`packages/domain` is independently testable and cannot import NestJS, Prisma, Redis, or React. Controllers validate transport data and delegate; they do not calculate money, construct notification messages, or know cache key patterns.

## Persistence model

### User

- `id`, `email`, `displayName`, `timezone`, timestamps.
- One seeded demo user is selected by server configuration. There is no pretend login.

### Category

- `id`, `name`, `slug`, `type`, `color`, `isActive`, timestamps.
- Unique per user and slug. Categories are deactivated, not deleted, when referenced.

### Transaction

- UUID `id`, `userId`, `categoryId`, `type`, `amount Decimal(14,2)`, `currency`, optional description.
- `transactionDate` is the user-selected economic event instant. `createdAt` is audit time. They are intentionally different.
- Persisted anomaly score, confidence, engine version, and JSON explanation snapshot preserve what the user saw even if the algorithm later changes.

### IdempotencyRecord

- Unique `(userId, key, operation)` plus request hash, status, response resource id, and expiry.
- The record and transaction are created in one serializable database transaction.

### Notification

- UUID `id`, `userId`, event type, severity, title, body, optional transaction link, read timestamp, created timestamp.

## Request lifecycle

- Middleware accepts a safe caller request ID or generates a UUID, stores it in async request context, returns it in `X-Request-Id`, and adds it to structured logs.
- A global validation pipe rejects unknown properties and transforms DTO primitives.
- A global exception filter emits a stable error envelope: `{ error: { code, message, details?, requestId } }` and hides stack traces in production.
- A global rate limiter protects accidental rapid repetition. Idempotency remains the correctness mechanism; throttling is not used as deduplication.

## Transaction evaluation and dry runs

`TransactionEvaluator.evaluate(candidate, history, periodContext)` is the single reusable path for:

- anomaly analysis;
- after-summary calculation;
- after-pulse calculation;
- before/after category spend;
- event facts consumed after a real commit.

Preview loads the same baseline and invokes the evaluator without persistence. Creation evaluates inside the database transaction against a consistent history snapshot, persists the result, and publishes facts only after a successful commit. This prevents preview/business-logic drift and avoids notifications for rolled-back writes.

## Concurrency and idempotency

The database uniqueness constraint is the final arbiter. Creation first attempts the serializable transaction. A unique-key race is resolved by loading the winner record and comparing the canonical request hash. Identical requests return the original transaction; a changed payload with the same key returns conflict. The limitation is intentionally documented: idempotency is scoped to one operation and demo user and retained records need a cleanup policy in a long-running system.

## Caching

Only aggregate summary and pulse responses are cached. Keys include user, timezone-aware period bounds, and a schema version. TTL is 60 seconds.

Mutation invalidation deletes the user's versioned aggregate key set. For this assignment the small key set is tracked in a Redis set, avoiding production-dangerous `KEYS` scans. If Redis read/write/delete fails, the service logs metadata only and computes from PostgreSQL. Transaction lists are not cached because filters and pagination create a large invalidation surface while indexed PostgreSQL queries are already cheap.

## Events and notification adapters

Application services publish typed facts such as `TRANSACTION_CREATED`, `HIGH_ANOMALY_DETECTED`, `CATEGORY_SPIKE_DETECTED`, and `LOW_SAVINGS_RATE`. Notification policy converts facts to messages. `NotificationChannel` adapters deliver messages. The in-app adapter persists them; the optional console adapter logs non-sensitive metadata in development.

The in-process event bus has an honest delivery limitation: it is not durable across process failure after commit. A production extension would write an outbox row in the transaction and dispatch asynchronously.

## Time and timezone

- PostgreSQL stores instants in `timestamptz`/UTC.
- The demo user owns an IANA timezone (`Asia/Kolkata` by default).
- Month and rolling-period boundaries are calculated in that timezone then converted to UTC for queries.
- The anomaly engine compares local transaction hours, not server hours.
- API dates are ISO instants. The web form converts `datetime-local` using the browser and displays the configured demo timezone.

## Security and privacy boundary

- No secrets in source; environment validation fails fast for required production values.
- CORS is a specific configured web origin.
- Prisma parameterizes database queries.
- Logs include IDs, event names, status, timing, and score bands but not amount, description, complete request bodies, or notification body.
- User-controlled descriptions are rendered as React text and never injected as HTML.
- The demo-user header cannot select an arbitrary user. Real authentication would verify a session/JWT and derive `userId` server-side before repository access.

