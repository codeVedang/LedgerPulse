# AI engineering journal

This is a contemporaneous decision log. It records actual AI suggestions and observed outcomes; it is not a retrospective list of invented mistakes.

## 2026-07-13 — Repository discovery and delivery shape

- **Task:** Inspect the starting repository and choose a build sequence.
- **AI suggestion:** Treat the prompt as a greenfield npm-workspace monorepo and freeze the behavioural formulas before scaffolding.
- **Disposition:** Accepted.
- **Engineering concern:** The Git root resolves to the Desktop, so normal repository-wide Git commands could include unrelated user files.
- **Human decision:** Constrain all writes and checks to `C:\Users\gamin\Desktop\ByteX`; do not initialize, stage, reset, or clean the parent repository as an implicit side effect.
- **Result:** Product, architecture, formula, and implementation contracts were written before code.

## 2026-07-13 — ORM and dependency line

- **Task:** Select Prisma or Drizzle and current framework versions.
- **AI suggestion:** Use Prisma for reviewer-readable schema/migrations, safe parameterization, transaction support, and PostgreSQL `Decimal`; initially consider the registry's latest Prisma 7 release.
- **Disposition:** Modified.
- **Engineering concern:** Prisma 7 introduces configuration and module-system migration work unrelated to the assignment. Adopting a new major solely because it is latest increases setup risk without demonstrating ledger judgment.
- **Human decision:** Pin the mature Prisma 6 line and document the trade-off. Use Next.js and NestJS current stable major lines.
- **Result:** Prisma 6.19.3 generated successfully, migrations ran in the production image, and the final dependency tree is valid.

## 2026-07-13 — Anomaly formula design

- **Task:** Turn qualitative anomaly examples into a deterministic, testable formula.
- **AI suggestion:** Combine category ratio, MAD, velocity, time-of-day, weekly spike, and new-category points, then clamp to 100.
- **Disposition:** Modified.
- **Engineering concern:** A weighted sum alone creates false confidence; MAD can be zero; percentage spikes against zero baselines are undefined; “late night” is culturally and individually biased; category ratio and MAD partly overlap.
- **Human decision:** Add per-signal evidence gates, omit zero-denominator rules, use circular hour support, cap amount-related influence, and separate confidence from score. Low confidence cannot emit a high-anomaly event.
- **Result:** Formula frozen in `docs/ANOMALY_SCORING.md` for test-first implementation.

## 2026-07-13 — Pulse methodology

- **Task:** Define a 0–100 pulse without a black box.
- **AI suggestion:** Weight savings rate, cash flow, velocity, anomaly count, and category concentration.
- **Disposition:** Modified.
- **Engineering concern:** Zero income makes savings rate undefined; empty ledgers can accidentally look excellent; low-confidence anomalies should not punish the user.
- **Human decision:** Return a nullable savings rate, use explicit neutral empty-data contributions, override the empty label to “Building baseline,” and exclude low-confidence anomaly scores.
- **Result:** Exact piecewise contributions frozen in `docs/FINANCIAL_PULSE_SCORING.md`.

## 2026-07-13 — First test configuration failure

- **Task:** Run the pure domain test suite after dependency installation.
- **AI suggestion:** Reuse the source `tsconfig.json` from the generated `ts-jest` preset.
- **Disposition:** Rejected after test execution.
- **Engineering concern:** The source config intentionally includes only Node types and `src`; Jest compiled the test files without `describe`, `it`, or `expect` types. Relaxing the production source config would leak test globals into the library.
- **Human decision:** Add a separate `tsconfig.test.json` used only by the Jest transform, with Jest types and test paths.
- **Result:** The separated configuration passed; the final domain suite contains 15 passing tests and source typechecking remains strict.

## 2026-07-13 — Deprecated Prisma seed configuration

- **Task:** Generate Prisma Client without warnings.
- **AI suggestion:** Put the seed command in the legacy `package.json#prisma` field.
- **Disposition:** Rejected after Prisma 6.19 emitted a deprecation warning.
- **Engineering concern:** Shipping known-deprecated configuration weakens reviewer confidence and makes the documented Prisma 7 upgrade harder.
- **Human decision:** Move schema, migration path, and seed command into typed `apps/api/prisma.config.ts`, which Prisma 6.19 already supports.
- **Result:** Prisma Client generated successfully with the typed config loaded and without the deprecation warning.

## 2026-07-13 — Optional description merge type error

- **Task:** Strict-typecheck the NestJS application layer.
- **AI suggestion:** Build the update candidate with `description: mergedValue ?? undefined` and a local request interface with an optional logging ID.
- **Disposition:** Rejected after TypeScript errors.
- **Engineering concern:** With `exactOptionalPropertyTypes`, explicitly present `undefined` is not the same as an absent optional field. The local request type also weakened the logging middleware's existing required `id` contract.
- **Human decision:** Conditionally spread `description` only when a value exists and use Express's augmented request type directly. Keep strict optional semantics enabled.
- **Result:** API and web strict typechecks both pass.

## 2026-07-13 — Type-aware lint scope failure

- **Task:** Run one strict lint command across the monorepo.
- **AI suggestion:** Apply `typescript-eslint` project-service rules indiscriminately to every file under the repository.
- **Disposition:** Modified after lint failed on Jest/config/seed files without discoverable TypeScript project ownership.
- **Engineering concern:** Ignoring all tests or disabling typed lint would hide useful issues; forcing build configs to include seed/tests would pollute production output roots.
- **Human decision:** Give domain tests and Prisma seed files local lint tsconfigs, include web TypeScript configs in its project, and exclude only non-TypeScript tool configuration plus the small Prisma config. Fix the application lint findings rather than broad rule suppression.
- **Result:** Repository-wide ESLint passes with zero warnings.

## 2026-07-13 — Nest 11 logging middleware warning

- **Task:** Start the compiled API against real PostgreSQL and Redis.
- **AI suggestion:** Accept `nestjs-pino`'s default `*` middleware route.
- **Disposition:** Modified after runtime evidence.
- **Engineering concern:** Nest 11 emitted a legacy `path-to-regexp` warning and auto-converted the logger middleware path. It did not break requests, but leaving compatibility warnings obscures meaningful operational logs.
- **Human decision:** Override the middleware route with the Nest 11 named wildcard `{*splat}` while keeping request correlation behaviour unchanged.
- **Result:** The rebuilt API started without the compatibility warning and retained correlated structured request logs.

## 2026-07-13 — Aggregate query review

- **Task:** Review dashboard persistence queries before final runtime verification.
- **AI suggestion:** Reuse a timeline-oriented query capped at 500 rows for summary and pulse calculations.
- **Disposition:** Rejected during code review before a failing test.
- **Engineering concern:** A silent row cap makes financial totals wrong as the ledger grows; cache performance must never trade away correctness.
- **Human decision:** Remove the cap from the aggregate source-of-truth query. Keep pagination only on transaction-list presentation endpoints.
- **Result:** Summary and pulse now calculate over the complete selected period.

## 2026-07-13 — Docker seed executable failure

- **Task:** Boot the production API image and run migrations plus the idempotent seed.
- **AI suggestion:** Invoke the root Prisma binary after changing into `apps/api`, assuming its seed child process would also discover root workspace binaries.
- **Disposition:** Rejected after the container entered a restart loop.
- **Engineering concern:** Prisma loaded `prisma.config.ts` but `spawn tsx ENOENT` showed the child-process `PATH` did not contain `/app/node_modules/.bin`. Local `npm run` had masked the packaging error by augmenting `PATH` automatically.
- **Human decision:** Add the root workspace binary directory explicitly to the runtime image `PATH`; retain the typed seed config and verify the actual container again.
- **Result:** Rebuilt image migrated, seeded, and started the Nest process successfully.

## 2026-07-13 — Container health-check address mismatch

- **Task:** Gate the web container on API health.
- **AI suggestion:** Probe `http://localhost:4000/api/health` from Alpine.
- **Disposition:** Modified after the running API was marked unhealthy.
- **Engineering concern:** BusyBox `wget` resolved `localhost` to the IPv6 loopback while Nest was intentionally listening on IPv4 `0.0.0.0`. Host requests and container `netstat` proved the API itself was healthy.
- **Human decision:** Make the probe deterministic with `127.0.0.1`; do not broaden the server binding or weaken the dependency health gate.
- **Result:** API and web containers both started; API health is green and both ports returned HTTP 200.

## 2026-07-13 — Unsafe automated audit remediation

- **Task:** Audit production dependencies after the successful container build.
- **AI/tool suggestion:** `npm audit` identified Next's pinned PostCSS 8.4.31 advisory but proposed Next 9.3.3 as its available automated fix.
- **Disposition:** Rejected.
- **Engineering concern:** Downgrading from Next 16 to 9 would be a breaking, misleading security response. The vulnerable package is a transitive build dependency and patched PostCSS 8.5.19 is compatible with the workspace's existing PostCSS toolchain.
- **Human decision:** First attempt a narrow override and rebuild. When npm 8 and npm 11 both retained Next's exact 8.4.31 pin and correctly marked the tree invalid, remove the ineffective override. Keep current stable Next, document the two moderate audit findings, and note that the application does not accept or stringify user-supplied CSS. Revisit when Next publishes a compatible patched pin.
- **Result:** The web production build remained clean, but the safe override was not technically enforceable; the advisory is an explicit known limitation, not hidden with an invalid tree.

## 2026-07-13 — Transaction detail response mismatch

- **Task:** Verify the high-anomaly demo transaction through the real detail endpoint.
- **AI suggestion:** Return `toTransactionResponse(row)` directly from `GET /transactions/:id` while the frontend contract expected `{ data: transaction }` like create/update/list item flows.
- **Disposition:** Rejected after the runtime check produced null fields in the verification projection.
- **Engineering concern:** Typechecking each app independently could not detect an informal REST envelope mismatch; the detail page would remain in its loading state.
- **Human decision:** Standardize the endpoint on `{ data }` and add a service-level response-contract regression test. Keep the error envelope separately shaped under `{ error }`.
- **Result:** The regression test passes; the rebuilt-container and browser verification are recorded in the final review.

## 2026-07-13 — Docker runtime dependency size

- **Task:** Review production image size after the first successful full-stack build.
- **AI suggestion:** Copy the installed monorepo dependency tree into both runtime images because it was the simplest reliable workspace setup.
- **Disposition:** Modified after measuring the result.
- **Engineering concern:** Both application images were approximately 1.6 GB and carried development dependencies unrelated to runtime. A hiring assignment should not hide packaging cost merely because Compose boots.
- **Human decision:** Install production-only workspace dependencies for the API and use Next's standalone server output for the web image while retaining only the migration/seed tooling required at API startup.
- **Result:** The rebuilt images fell to approximately 725 MB for API and 304 MB for web and remained healthy.

## 2026-07-13 — Category concentration precision review

- **Task:** Validate the Financial Pulse category-concentration calculation.
- **AI suggestion:** Calculate HHI from category percentage shares already rounded for the UI response.
- **Disposition:** Rejected during formula review.
- **Engineering concern:** Presentation rounding changes the squared-share result and can move a score near a piecewise threshold. A transparent formula should still use exact inputs.
- **Human decision:** Calculate HHI directly from exact Decimal category amounts and expose rounded shares only for presentation.
- **Result:** An exact `0.5556` regression case now passes independently of displayed percentage rounding.

## 2026-07-13 — Demo-data discoverability

- **Task:** Conduct the first rendered dashboard review with a fresh seed.
- **AI suggestion:** Seed only a user and categories so the initial state remained technically pure.
- **Disposition:** Modified after product review.
- **Engineering concern:** An empty dashboard hid the assignment's main differentiator and forced a reviewer to manually create weeks of history before confidence-gated rules became visible.
- **Human decision:** Add deterministic, labelled example history evaluated by the real engine, plus a `SEED_DEMO_DATA=false` escape hatch for an empty ledger. Do not hard-code a fake analysis response.
- **Result:** The seed produces a high-confidence Festival tickets expense with score 80 and four real rule contributions; rerunning the seed remains idempotent.

## 2026-07-13 — Demo timezone consistency

- **Task:** Review form input, filters, API month boundaries, and display around timezone boundaries.
- **AI suggestion:** Use the browser's default timezone for `datetime-local` conversion while the server used the demo user's `Asia/Kolkata` timezone.
- **Disposition:** Rejected during final review.
- **Engineering concern:** A reviewer outside India could record or filter a different instant from the labelled demo-user time, especially near a month boundary.
- **Human decision:** Make the demo timezone explicit in the UI and use `date-fns-tz` for input conversion, display, and filter boundaries. Continue sending ISO instants to the API.
- **Result:** Lint, strict typecheck, all tests, and the production build pass with the explicit timezone path.

## 2026-07-13 — Clearing an optional description

- **Task:** Review PATCH semantics for an optional transaction description.
- **AI suggestion:** Treat a blank transformed value like an omitted field during merge.
- **Disposition:** Modified.
- **Engineering concern:** That makes it impossible for a user to remove an existing description, even though omission should still mean “leave unchanged.”
- **Human decision:** Distinguish property presence from value, accept explicit `null`/blank as clear on PATCH, and write `null` to persistence while keeping create validation simple.
- **Result:** Strict optional typing and the full verification suite pass with clear-versus-omit semantics intact.

## 2026-07-14 — Impossible time-pattern evidence boundary

- **Task:** Review whether the local-time rule's evidence gate matched its documented sample threshold.
- **AI/implementation suggestion:** Require at least 12 category observations and at least 14 distinct local dates.
- **Disposition:** Rejected after targeted review.
- **Engineering concern:** Distinct dates cannot exceed observations, so the 12-observation claim was misleading and the rule could never run with 12–13 observations. The contradictory boundary had not been covered by a focused test.
- **Human decision:** Require at least 12 category observations across at least 12 distinct local dates. Twelve observations give the 8%/15% support bands their minimum useful granularity, while separate local dates avoid treating a same-day burst as independent temporal evidence. Add the distinct-date count to structured rule evidence.
- **Result:** Focused boundary tests now prove the rule triggers at 12 observations/12 dates and remains gated at 12 observations/11 dates. The first repository lint pass then rejected a nested Jest asymmetric matcher because it assigned an untyped `any` to `evidence`; the assertion was replaced with a typed reason lookup and direct evidence checks. Lint, all workspace typechecks, all 25 tests, and both production builds then passed.
