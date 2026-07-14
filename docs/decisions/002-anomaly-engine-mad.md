# ADR 002: Robust, gated anomaly statistics

## Context

Mean and standard deviation are distorted by previous outliers, but small histories do not justify robust statistical claims either.

## Decision

Use category median and MAD only after explicit sample gates. Combine them with independently gated velocity, local-time, weekly-spike, and new-behaviour rules. Return confidence separately from score and persist the versioned explanation snapshot.

## Alternatives considered

- Z-score using mean/standard deviation: too sensitive to the exact outliers being detected.
- Isolation Forest or external AI: less explainable, unnecessary at mini-ledger scale, and contrary to the deterministic requirement.
- A single amount-ratio rule: simple but misses bursts and category-level changes.

## Trade-offs

Thresholds are product heuristics, not population-trained risk estimates. They are transparent and testable but would need calibration against consented real behaviour before broader claims.

