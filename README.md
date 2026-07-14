# LedgerPulse

LedgerPulse is an explainable financial-behaviour and anomaly-aware mini-ledger. It records income and expenses, but its main question is different from a typical expense tracker: **what changed in this user's behaviour, and what evidence supports that conclusion?**

This is a production-minded hiring assignment, not a claim of production readiness. It is deliberately honest about small samples, cache failure, single-user scope, and notification-delivery limitations.

**Live deployment:** [Open LedgerPulse](https://web-production-ff552.up.railway.app) · [API health](https://api-production-271c.up.railway.app/api/health)

The Railway deployment runs the Next.js web app, NestJS API, PostgreSQL, and Redis as separate services and includes deterministic demo data so the Behaviour Fingerprint can be reviewed immediately.

## 1. Problem interpretation

A useful ledger should preserve exact financial records first. Behaviour analysis is secondary and must never compromise arithmetic, persistence, or trust. LedgerPulse therefore separates:

- exact Decimal ledger calculations;
- a deterministic, versioned Behaviour Fingerprint engine;
- confidence based on available evidence, independent of score;
- preview evaluation from persistence through one reusable evaluator;
- notification policy from HTTP controllers.

The product does not call unusual spending fraud, risk, or wrongdoing. It describes deviation from the recorded demo user's own history.

## 2. Product philosophy

Three principles shaped the implementation:

1. **Explain the score.** Every contribution has a rule, evidence gate, points, and user-facing reason.
2. **Do not manufacture certainty.** Sparse histories return `LOW` confidence even when an early signal looks large.
3. **Failure should degrade capability, not correctness.** Redis may disappear; PostgreSQL remains authoritative.

Features that would add surface area without strengthening those principles—bank feeds, budgets, recurring predictions, fake authentication, external “AI insights,” and a message broker—were kept out of scope.

## 3. Core features

- Create, preview, read, filter, sort, update, and delete transactions.
- Income/expense categories with inactive-history protection.
- Current-period income, expense, net cash flow, and nullable savings rate.
- Behaviour analysis with score, confidence, reasons, component points, and expected ranges.
- Non-persisting What-If Simulator.
- Explainable Financial Pulse score and component drawer.
- Behaviour Pulse Timeline whose intensity encodes anomaly score.
- Event-driven in-app notifications and a development console adapter.
- Database-backed idempotent creation.
- Summary/pulse Redis caching with PostgreSQL fallback.
- Correlation IDs, structured logs, a stable error envelope, input validation, CORS, Helmet, and rate limiting.

The default seed is intentionally labelled demo data and includes enough deterministic history to make the differentiator immediately reviewable. Set `SEED_DEMO_DATA=false` for a clean categories-only ledger.

## 4. The unique twist

The Behaviour Fingerprint is framework-free code in `packages/domain`. It receives a candidate transaction, historical observations, and the user's IANA timezone; it performs no database, network, Redis, NestJS, or LLM calls.

Each persisted expense keeps an immutable analysis snapshot containing:

- engine version (`behaviour-v1`);
- anomaly score and confidence;
- structured reason codes and evidence;
- points awarded by each component;
- expected amount and daily-frequency ranges where defensible.

This preserves what the user saw if a future engine version changes.

## 5. Behaviour Fingerprint architecture

```text
validated candidate + historical expenses + local timezone
                         |
                         v
                 Behaviour engine
      ┌──────────────┬──────────────┬──────────────┐
      amount ratio   robust MAD     velocity/time
      category spike new behaviour confidence gates
      └──────────────┴──────────────┴──────────────┘
                         |
                         v
        score + confidence + reasons + expectations
```

The application-level `TransactionEvaluator` calls this engine for both `POST /transactions/preview` and real creation. Preview has no persistence, idempotency reservation, cache invalidation, or event emission.

## 6. Anomaly scoring methodology

The score is an additive, clamped `0–100` heuristic:

| Signal | Maximum | Evidence gate | Purpose |
| --- | ---: | --- | --- |
| Category amount deviation | 35 | 3 category expenses | Candidate/median ratio |
| Robust MAD deviation | 20 | 8 category expenses, non-zero MAD | Robust distance from category median |
| Three-hour category velocity | 15 | 10 overall, 5 category, 7 days | Candidate count vs historical rolling-window p95 |
| Local-time pattern | 10 | 12 category expenses across 12 local dates | Circular ±2-hour historical support |
| Seven-day category spike | 15 | 28 days and 4 prior weekly windows | Recent spend vs prior-window median |
| New behaviour | 15 | 10 overall and unseen category | New category in an established ledger |

Amount ratio and MAD have capped influence because they are correlated. MAD is omitted when it is zero; weekly percentage claims are omitted when their baseline is zero. Time-of-day is compared with the user's history—“late night” is never treated as inherently suspicious. The time rule requires 12 observations on 12 distinct local dates so same-day repetitions do not substitute for independent temporal coverage.

Severity bands are normal `0–29`, watch `30–59`, unusual `60–79`, and high `80–100`. A transaction is flagged only at `>=60` with `MEDIUM` or `HIGH` confidence. See [the complete piecewise formula](docs/ANOMALY_SCORING.md).

## 7. Confidence and insufficient-history handling

Confidence measures baseline maturity, not how dramatic one data point looks:

- `LOW`: fewer than 6 prior expenses, or fewer than 3 in the category.
- `MEDIUM`: at least 6 prior expenses, 5 in-category observations, and 7 days.
- `HIGH`: at least 20 prior expenses, 8 in-category observations, and 28 days.

A low-confidence result can show provisional evidence, but cannot trigger a high-anomaly notification or reduce the Financial Pulse. Expected amount uses observed category quartiles; expected daily frequency uses quartiles of non-zero active-day counts. Missing evidence produces no fabricated range.

## 8. What-If Simulator

The Add Transaction flow can preview:

- monthly expense before/after;
- savings rate before/after, including an honest undefined state at zero income;
- selected-category spending change;
- projected month-end balance before/after;
- the exact behaviour analysis the real creation path would use.

`TransactionEvaluator` is the shared dry-run boundary. Confirmation reruns evaluation inside the serializable database transaction, because history may have changed between preview and save. The preview is guidance, not a reservation.

## 9. Financial Pulse methodology

Financial Pulse is not a credit score or financial advice. It is the visible sum of five components:

`Pulse = savings health (30) + cash-flow position (20) + velocity (15) + anomaly load (20) + concentration (15)`

| Component | Method |
| --- | --- |
| Savings health | Piecewise savings-rate contribution; `null`, not division by zero, when income is zero |
| Cash-flow position | Net cash flow divided by income, with explicit zero-income branches |
| Spending velocity | Last 7 local calendar days' daily expense vs preceding 21 days |
| Anomaly load | Penalty only for reliable current-period scores `>=60` |
| Category concentration | Herfindahl–Hirschman Index calculated from exact category amounts |

The “How is this calculated?” interaction shows raw input, contribution, maximum, and explanation for every component. Empty data receives a neutral score of 61 but the label is overridden to **Building baseline**, not “steady.” The exact piecewise rules are in [the Financial Pulse methodology](docs/FINANCIAL_PULSE_SCORING.md).

## 10. Notification architecture

Transaction code publishes typed facts only after commit:

- `TRANSACTION_CREATED`
- `HIGH_ANOMALY_DETECTED`
- `CATEGORY_SPIKE_DETECTED`
- `LOW_SAVINGS_RATE`

`NotificationPolicy` converts facts into messages; `NotificationDispatcher` sends them to `NotificationChannel` implementations. `InAppNotificationChannel` persists notifications. The development console adapter logs event metadata without amounts or descriptions. Adding email or webhook delivery means implementing the channel interface, not changing controllers.

The current bus is intentionally in-process. A crash between database commit and publish can lose an event. A production system should write a transactional outbox row beside the transaction and dispatch it asynchronously; Kafka/RabbitMQ and a worker were disproportionate for this assignment.

## 11. Tech stack and engineering choices

- Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- NestJS 11 and TypeScript.
- PostgreSQL 17 and Prisma 6.
- Redis 7.4 through `ioredis`.
- `decimal.js` across the domain boundary.
- Jest for pure-domain and backend service tests.
- npm workspaces and Docker Compose.

Prisma was selected over Drizzle because its declarative schema is fast for a reviewer to understand, its Decimal/PostgreSQL mapping is explicit, its generated parameterized client reduces handwritten persistence code, and it supports the serializable transaction needed for idempotency. Prisma 6 was intentionally selected instead of introducing Prisma 7 migration work unrelated to the assignment. The trade-off is a larger generated/runtime footprint and less direct SQL control.

## 12. Architecture

```text
apps/web  ──REST──>  apps/api controllers
                         |
                  application services
                 /          |          \
        packages/domain   Prisma      domain events
        calculations      PostgreSQL      |
              |               |      notification channels
              └── aggregate cache ── Redis (optional)
```

```text
apps/
  api/       transport, application, persistence, cache and adapters
  web/       App Router UI and deliberate visualizations
packages/
  domain/    pure Decimal financial, anomaly and pulse engines
  contracts/ transport-safe shared shapes
docs/        specifications, formulas, ADRs, journal and final review
```

Controllers translate HTTP only. They do not calculate money, score behaviour, build notification prose, or know Redis keys. The fuller dependency description is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 13. Database design

- `User` owns a timezone and is the future isolation boundary.
- `Category` is unique per user/slug, typed as income or expense, and deactivated rather than deleted when referenced.
- `Transaction` stores `numeric(14,2)`, ISO currency, economic event time, audit timestamps, and a versioned anomaly snapshot.
- `IdempotencyRecord` has a unique `(userId, key, operation)` constraint, request hash, resource link, and expiry.
- `Notification` stores message, severity, event type, optional transaction link, and read time.

Indexes support user/date lists, type/date filters, category/date history, unread notifications, and expiry cleanup. Category deletion is restricted while history exists; reassignment validates active state and matching transaction type.

## 14. Money and decimal precision

Amounts are PostgreSQL `numeric(14,2)` and Prisma `Decimal`. Persistence values cross into the pure domain as strings and become `decimal.js` values. API JSON serializes amounts and rates as decimal strings. No ledger arithmetic uses JavaScript `number`.

Inputs must be `0.01–999999999999.99` with at most two fractional digits. Negative and zero amounts are rejected rather than silently made positive. The test suite explicitly demonstrates `0.10 + 0.20 = 0.30`, zero-income savings behaviour, and exact negative cash flow. See [ADR 001](docs/decisions/001-money-decimal-strategy.md).

## 15. Timezone decisions

`transactionDate` is the user-selected economic event; `createdAt` is the server audit time. PostgreSQL stores both as UTC instants. Month and rolling-window boundaries are calculated in the demo user's `Asia/Kolkata` timezone and converted to UTC. The anomaly engine compares local hours, not server hours.

The web form labels its timezone, converts `datetime-local` from Asia/Kolkata to an ISO instant, formats records in the same timezone, and builds filter boundaries from that zone. A date up to five minutes ahead is tolerated for device-clock skew; later future dates are rejected.

## 16. Redis caching strategy

Only expensive summary and pulse aggregates are cached. Versioned keys include user and period bounds and expire after 60 seconds. A small per-user Redis set records aggregate keys so create/update/delete can invalidate them without a blocking `KEYS` scan.

Transaction lists are intentionally not cached: combinations of pagination, sorting, category, type, date, and amount create a broad invalidation surface, while indexed PostgreSQL reads remain inexpensive. This chooses understandable consistency over hit-rate theatre.

Every Redis read/write/delete catches and structurally logs failure, opens a short local circuit after repeated failures, and behaves as a miss. Runtime verification stopped Redis and confirmed summary still returned from PostgreSQL. If invalidation itself fails, an old cache value can live until its 60-second TTL; the ledger remains correct in PostgreSQL.

## 17. Idempotency

The frontend generates a UUID per submission and reuses it when retrying that submission. The backend requires `Idempotency-Key` on `POST /transactions` and hashes the canonical validated semantic payload.

The idempotency record and transaction are created in one serializable PostgreSQL transaction. Database uniqueness resolves concurrent duplicates. An identical retry returns the original resource with `replayed: true`; the same key with different content returns `409 Conflict`. Redis is not involved in correctness.

Limitations: records are scoped to operation and demo user; their expiry field needs a scheduled cleanup in a long-running deployment; deleting the linked transaction leaves the record without a replayable resource and should be governed by a product retention policy.

## 18. Error handling and observability

DTO validation whitelists fields and rejects unknown input. Expected errors use one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": ["amount must be a positive decimal with at most 2 fractional digits"],
    "requestId": "…"
  }
}
```

Caller-safe correlation IDs are accepted or generated, returned in `X-Request-Id`, and attached to structured Pino logs. Production 500 responses hide stacks. Logs record request metadata, database/cache failures, and anomaly score bands, but not amounts, descriptions, notification bodies, or full request payloads.

Helmet, intentional single-origin CORS, ORM parameterization, DTO bounds, and global throttling provide assignment-level protection. Rate limiting limits abuse; idempotency provides duplicate correctness.

## 19. Edge cases considered

| Case | Behaviour |
| --- | --- |
| Zero income | Savings rate is `null`; pulse uses an explicit branch |
| Zero/negative amount | Validation error; never normalized |
| Large/over-precision money | Bounded string validation and `numeric(14,2)` |
| Duplicate/concurrent create | UUID key, canonical hash, serializable transaction, unique constraint |
| Empty ledger | Zero totals, useful empty states, `Building baseline` pulse |
| Insufficient anomaly history | `LOW` confidence; no reliable alert or pulse penalty |
| Deleted/inactive category | Historical link retained; inactive categories reject new assignment |
| Category reassignment | Active and same-type validation, then analysis/cache refresh |
| Redis unavailable | Structured warning and PostgreSQL calculation |
| Database/internal failure | Stable 500 envelope and correlation log; no stack leak |
| Invalid/future date | Strict ISO input and five-minute future tolerance |
| Timezone/month boundary | User-zone bounds converted to UTC |
| Rapid requests | Throttling plus database idempotency |
| Blank/missing description | Optional on create; PATCH `null`/blank explicitly clears it |
| Unsupported currency | Explicit rejection; INR only, no fake conversion |

## 20. Testing strategy

The 25 tests prioritize business boundaries:

- 10 anomaly tests: sparse history, median outlier, MAD, velocity, category spike, time-pattern eligibility, insufficient temporal diversity, normal, extreme clamp, and income.
- 4 exact financial tests: savings, zero income, decimal precision, negative net flow.
- 3 pulse tests: empty state, low-confidence exclusion, exact HHI.
- 4 cache tests: hit, miss, registry invalidation, Redis failure fallback.
- 4 transaction tests: identical replay, changed-payload conflict, concurrent unique race, detail response contract.

Commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Runtime checks additionally exercised migrations/seed, preview non-persistence, duplicate replay, summaries, notifications, Redis outage fallback, API/web HTTP health, and desktop/mobile browser flows.

## 21. AI-assisted development

OpenAI Codex was used as a coding co-pilot for repository inspection, architecture alternatives, initial scaffolding, test-case generation, implementation, runtime diagnostics, documentation drafting, and final review. The formulas and failure policies were frozen before the bulk implementation so generated code had an explicit contract to meet.

The contemporaneous [AI engineering journal](docs/AI_ENGINEERING_JOURNAL.md) records each meaningful suggestion, whether it was accepted/modified/rejected, the engineering concern, the human decision, and the observed result.

## 22. Where AI accelerated development

- Turned a broad prompt into bounded product, architecture, formula, and ADR documents early.
- Generated typed seams between pure domain code and NestJS/Prisma infrastructure.
- Produced a broad first pass of statistical and failure-mode tests quickly.
- Helped run repetitive lint/type/build/container/browser feedback loops.
- Proposed edge cases that were then made concrete through validation and tests.

Acceleration was most useful where correctness criteria were already explicit. It was least trustworthy at toolchain boundaries and implicit contracts.

## 23. Where AI fell short

Only observed issues are listed here; none were invented for the assignment:

- Reused the source TypeScript config for Jest and omitted test globals; a separate test config fixed it.
- Suggested a deprecated Prisma seed field; runtime warnings led to typed `prisma.config.ts`.
- Produced invalid `exactOptionalPropertyTypes` merges; conditional property spreads preserved the stricter model.
- Applied type-aware lint too broadly; project ownership was made explicit instead of disabling useful rules.
- Accepted Nest 11's legacy wildcard logger route; a named wildcard removed the compatibility warning.
- Reused a 500-row timeline query for aggregate totals; review removed the silent correctness cap.
- Assumed workspace binaries would be on a Docker seed child-process path; the first container restart-looped with `tsx ENOENT`.
- Used `localhost` in an Alpine health check; IPv6 resolution marked a healthy IPv4 API unhealthy.
- Returned one transaction detail outside the shared `{ data }` contract; runtime verification found it and a regression test now covers it.
- Suggested copying the complete workspace dependency tree into runtime images; the final Dockerfiles use production dependencies/standalone output instead.

The audit tool also proposed a forced downgrade from Next 16 to Next 9 for a moderate PostCSS advisory. That automated fix was rejected as materially unsafe.

## 24. Human engineering decisions

Human judgment changed the result in the places where a plausible implementation was not a defensible one:

- separated confidence from anomaly magnitude;
- gated every statistical claim and omitted undefined baselines;
- used exact Decimal values and exact HHI inputs;
- reran evaluation at confirmation instead of treating preview as a lock;
- kept cache optional and database-backed idempotency authoritative;
- removed a silent aggregate row cap even though it improved query cost;
- kept authentication honestly out of scope instead of accepting a user header as security;
- rejected an invalid dependency override and disclosed the residual advisory;
- seeded a reviewable, labelled history while preserving a clean-ledger switch;
- fixed local-time input/display semantics during the final review.

## 25. Running locally

Prerequisites: Node.js 22+, npm, Docker Desktop/Engine with Compose.

### Fastest reviewer path

```bash
docker compose up --build
```

Then open `http://localhost:3000`. The API is at `http://localhost:4000/api` and health at `http://localhost:4000/api/health`. Migrations and idempotent seed run when the API starts. The default data includes a labelled high-anomaly entertainment purchase.

### Run applications on the host

PowerShell setup:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Set `SEED_DEMO_DATA=false` before seeding to create only the demo user and categories. The seed uses fixed identifiers and `upsert`/existence checks, so it is safe to rerun.

## 26. Docker setup

Compose provides PostgreSQL, Redis, API, and web services with health gates and persistent named volumes. The API runtime image carries production workspace dependencies plus compiled output and executes migrations/seed before Nest starts. The web image uses Next standalone output rather than the development dependency tree.

Useful commands:

```bash
docker compose ps
docker compose logs api
docker compose down
docker compose down -v  # destructive: also removes local ledger/Redis volumes
```

The final command is intentionally labelled destructive.

## 27. Environment variables

| Name | Purpose | Example/default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection | local Compose credentials in `.env.example` |
| `REDIS_URL` | Optional aggregate cache | `redis://localhost:6379` |
| `PORT` | API port | `4000` |
| `WEB_ORIGIN` | Exact allowed browser origin | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Browser-visible API base | `http://localhost:4000/api` |
| `DEMO_USER_ID` | Configured honest single-user identity | fixed UUID |
| `SEED_DEMO_DATA` | Seed reviewable history or categories only | `true` |
| `LOG_LEVEL` | Structured logging threshold | `info` |
| `NODE_ENV` | Runtime mode | `development` / `production` |

Do not use the checked-in local credentials outside local development.

## 28. API overview

All routes are prefixed with `/api`.

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/transactions/preview` | Dry run; no idempotency key or persistence |
| `POST` | `/transactions` | Requires UUID `Idempotency-Key` |
| `GET` | `/transactions` | `type`, `categoryId`, `from`, `to`, min/max, sort, page, limit |
| `GET` | `/transactions/:id` | Includes stored behaviour analysis |
| `PATCH` | `/transactions/:id` | Partial update; re-evaluates analysis |
| `DELETE` | `/transactions/:id` | `204`; confirmation is handled in the UI |
| `GET` | `/ledger/summary` | Optional ISO `from`/`to`; current user month by default |
| `GET` | `/ledger/pulse` | Explainable component response |
| `GET` | `/ledger/timeline` | Transactions optimized for anomaly visualization |
| `GET` | `/notifications` | Optional `unreadOnly=true` |
| `PATCH` | `/notifications/:id/read` | Marks one notification read |
| `GET` | `/categories` | Includes active categories for form choices |

## 29. Known limitations

- Authentication is omitted deliberately. The server derives one configured demo user; there is no fake login. Production would validate a session/JWT, derive `userId` server-side, authorize every repository query, and add tenant-level tests.
- In-process events are not durable after commit; a transactional outbox is the next reliability step.
- Stored anomaly snapshots are recalculated for the edited transaction, but later historical snapshots are not retrospectively rewritten when earlier history changes. This preserves audit meaning but needs a versioned replay policy if retrospective views are required.
- Offset pagination is sufficient here; a large, rapidly changing ledger should use cursor pagination.
- Idempotency expiry cleanup is modelled but no scheduler is included.
- INR is the only supported currency and there is no conversion.
- The thresholds are transparent product heuristics, not population-calibrated fraud or credit models.
- `npm audit --omit=dev` reports two moderate advisories from Next 16.2.10's exact transitive PostCSS pin. No application flow accepts or stringifies user CSS, and no high/critical advisory is present. npm's offered fix is an unsafe Next 9 downgrade; upgrade when Next publishes a compatible patched dependency.

## 30. What I would build next

In order:

1. Transactional outbox with retry, delivery status, and webhook adapter.
2. Real authentication/authorization and per-user timezone/currency settings.
3. Versioned historical-analysis replay policy with reviewer-visible “evaluated under v1” semantics.
4. Cursor pagination and database integration tests against disposable PostgreSQL.
5. Accessibility automation and focused React interaction tests for preview/focus/error flows.
6. Calibrate heuristic thresholds against consented, anonymized behaviour without weakening explainability.

## Five-minute reviewer path

1. Run `docker compose up --build` and open the dashboard.
2. Inspect the labelled Festival tickets point on the Behaviour Pulse Timeline.
3. Open its detail page and read the four deterministic reasons and observed range.
4. Add an Entertainment expense, choose **Preview impact**, and compare before/after metrics without saving.
5. Read [the anomaly formula](docs/ANOMALY_SCORING.md), [the AI journal](docs/AI_ENGINEERING_JOURNAL.md), and [the final review](docs/FINAL_REVIEW.md).
