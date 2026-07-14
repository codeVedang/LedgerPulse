# Behaviour Fingerprint scoring methodology

## Goal and non-goals

The engine measures how different an expense is from a user's recorded behaviour. It does not estimate fraud or intent. It is deterministic, versioned as `behaviour-v1`, and receives plain observations plus a candidate; it performs no I/O.

Income transactions return score `0`, confidence `LOW`, and an explanation that behavioural scoring currently applies to expenses.

## Evidence gates

- `LOW`: fewer than 6 prior expenses overall, or the candidate category has fewer than 3 observations. The engine may show provisional signals, but they are explicitly not a reliable baseline.
- `MEDIUM`: at least 6 prior expenses, at least 5 in-category observations, and at least 7 days of history.
- `HIGH`: at least 20 prior expenses, at least 8 in-category observations, and at least 28 days of history.

Confidence is based on history *before* the candidate. It is not increased because an individual rule produces a large value. A score at `LOW` confidence never emits `HIGH_ANOMALY_DETECTED`.

## Score components

All ratios use Decimal arithmetic. Component points are rounded to the nearest integer only at the final component boundary. The total is clamped to `[0, 100]`.

### 1. Category amount deviation — 0 to 35

Available with at least 3 prior category expenses.

`ratio = candidate amount / category median`

- ratio `< 1.5`: 0
- `1.5–2`: linear 5–12
- `2–4`: linear 12–25
- `4–8`: linear 25–32
- `>= 8`: 35

The median is robust to previous very large purchases. The explanation reports the ratio and median.

### 2. Robust MAD deviation — 0 to 20

Available with at least 8 prior category expenses and non-zero MAD.

`robustZ = 0.6745 × |candidate - median| / MAD`

- robust Z `<= 2.5`: 0
- `2.5–3.5`: linear 4–10
- `3.5–6`: linear 10–18
- `>= 6`: 20

When MAD is zero, this rule is omitted rather than dividing by zero or pretending infinite certainty. Amount deviation can still describe the event.

### 3. Category velocity — 0 to 15

Available with at least 10 overall expenses, at least 5 category expenses, and 7 days of history.

Count same-category expenses in the 3 hours ending at the candidate, including the candidate. Compare that count with the historical 95th percentile of counts observed in rolling 3-hour windows anchored at prior category transactions.

- candidate count `<= max(2, p95)`: 0
- one above baseline: 6
- two above: 10
- three or more above: 15

This detects user-specific bursts rather than applying a global transaction limit.

### 4. Local-time pattern — 0 to 10

Available with at least 12 prior category expenses across at least 12 distinct local dates. Requiring separate local dates limits pseudo-replication from same-day bursts, while 12 observations provide the minimum resolution needed for the 8% and 15% support bands. This is an evidence threshold for a product heuristic, not a statistical significance claim.

Hours are circular. The engine finds the fraction of history within `±2` hours of the candidate local hour.

- support `>= 15%`: 0
- support `8–15%`: linear 3–7
- support `< 8%`: 10

This avoids the false rule that night-time activity is inherently suspicious. The same hour can be normal for one user and unusual for another.

### 5. Category spending spike — 0 to 15

Available with at least 28 days of expense history and at least 4 non-overlapping prior 7-day category windows.

Compare category spend in the 7-day window ending at the candidate, including the candidate, with the median of the four preceding non-overlapping 7-day windows.

- historical median zero: omit this component; a zero baseline cannot support a percentage claim
- ratio `< 1.5`: 0
- `1.5–2`: linear 4–8
- `2–3`: linear 8–12
- `>= 3`: 15

### 6. New behaviour — 0 to 15

Available with at least 10 overall prior expenses and no prior expense in the category. It contributes 15 points and explicitly says the category is new to the established ledger. With fewer than 10 overall expenses, new category data is treated as baseline-building and scores 0.

## Severity and flag policy

- `0–29`: normal
- `30–59`: watch
- `60–79`: unusual
- `80–100`: high

A transaction is **flagged** at score `>= 60` only when confidence is `MEDIUM` or `HIGH`. The UI can still show a low-confidence numeric result, but must pair it with the baseline warning and must not render it as a statistically reliable alert.

## Expected behaviour

When category evidence permits:

- typical amount range is the 25th–75th percentile, not a fabricated normal distribution;
- typical daily frequency is the 25th–75th percentile of non-zero category transaction counts on active local days;
- all values are labelled as observed historical ranges.

The engine returns structured reason codes, evidence values, human-readable text, and component points. Notification policy uses codes and severity; it never parses prose.
