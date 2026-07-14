# LedgerPulse implementation plan

This plan optimizes for hiring signal: correctness and explainability before breadth.

## Phase 1 — discovery

- [x] Inspect repository and instructions.
- [x] Confirm repository is empty and Git root is outside the project directory.
- [x] Confirm Node and Docker tooling.

## Phase 2 — product and architecture contract

- [x] Define scope, domain rules, schema, dry-run architecture, cache policy, and events.
- [x] Freeze anomaly formula and confidence gates before implementation.
- [x] Freeze Financial Pulse components before implementation.
- [x] Record major choices as ADRs.

## Phase 3 — workspace and infrastructure

- [x] Create npm workspaces, strict TypeScript bases, linting, and formatting.
- [x] Add PostgreSQL/Redis Docker Compose services and multi-stage app Dockerfiles.
- [x] Add checked-in `.env.example` and environment validation.

## Phase 4 — domain and backend foundation

- [x] Implement Prisma schema, seed data, and migration.
- [x] Implement Decimal-only domain models and financial calculator.
- [x] Add correlation IDs, structured logging, error envelope, CORS, and throttling.

## Phase 5 — transaction lifecycle

- [x] Implement DTOs, filters, pagination, CRUD, and category rules.
- [x] Implement canonical request hashing and database-backed idempotency.
- [x] Keep controllers free of policy and calculation logic.

## Phase 6 — Behaviour Fingerprint

- [x] Implement pure anomaly engine from the frozen formula.
- [x] Store versioned analysis snapshots.
- [x] Cover insufficient history, normal, outlier, MAD, velocity, spike, extreme, and clamp tests.

## Phase 7 — summaries and resilience

- [x] Implement timezone-aware ledger summaries.
- [x] Cache aggregate responses only.
- [x] Invalidate on mutation and prove Redis failure fallback in tests.

## Phase 8 — Financial Pulse

- [x] Implement pure component calculator with exact contribution breakdown.
- [x] Exclude low-confidence anomalies from the penalty.

## Phase 9 — domain events and notifications

- [x] Implement typed event bus, notification policy, and channels.
- [x] Publish after commit; document the outbox limitation.

## Phase 10–12 — web product and polish

- [x] Create shared application shell, dashboard, transactions, add/preview, detail, and notifications.
- [x] Build the SVG Behaviour Pulse Timeline with accessible detail equivalents.
- [x] Add skeletons, empty/error states, keyboard focus, responsive layouts, toasts, and destructive confirmation.

## Phase 13 — verification

- [x] Run lint, typecheck, domain/backend tests, and production builds.
- [x] Exercise API with PostgreSQL/Redis running.
- [x] Stop Redis and verify successful summary fallback.
- [x] Check repeated idempotency key behaviour.

## Phase 14–15 — evidence and review

- [x] Reconcile AI journal against actual failures and accepted/rejected suggestions.
- [x] Write the README from implemented evidence only.
- [x] Conduct strict hiring-manager review.
- [x] Fix realistic high/medium findings and re-run verification.
