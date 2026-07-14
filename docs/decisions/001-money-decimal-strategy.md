# ADR 001: Money decimal strategy

## Context

JavaScript numbers are binary floating point and cannot safely represent common decimal money operations. PostgreSQL must remain authoritative.

## Decision

Store amounts as PostgreSQL `numeric(14,2)` through Prisma `Decimal`. Convert repository values to `decimal.js` strings at the domain boundary. Calculators accept and return decimal strings; JSON never exposes a binary float amount. Reject more than two fractional digits and values outside `0.01–999999999999.99`.

## Alternatives considered

- Integer paise: safe and fast, but constrains future currencies and makes ORM/report queries less legible.
- JavaScript number plus rounding: rejected because rounding at presentation does not repair intermediate precision loss.

## Trade-offs

Decimal objects require explicit serialization and comparisons. The additional ceremony is valuable because it makes unsafe arithmetic difficult to introduce accidentally.

