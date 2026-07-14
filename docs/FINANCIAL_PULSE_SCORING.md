# Financial Pulse scoring methodology

## Purpose

Financial Pulse is a current-period health snapshot, not a credit score and not financial advice. It is a transparent sum of five components. Each response contains the raw inputs, contribution, maximum contribution, and explanation.

`Pulse = savings health (30) + cash-flow position (20) + spending velocity (15) + anomaly load (20) + category concentration (15)`

The total is rounded and clamped to `0–100`.

## 1. Savings health — 0 to 30

`savings rate = (income - expenses) / income × 100`

When income is positive:

- rate `<= 0%`: 0
- `0–20%`: linear 0–24
- `20–40%`: linear 24–30
- `>= 40%`: 30

When income is zero, the savings rate is `null`, never `Infinity` or `0%`. The contribution is 15 (neutral) if both income and expenses are zero, otherwise 0.

## 2. Cash-flow position — 0 to 20

With positive income, use `net cash flow / income`:

- ratio `<= -25%`: 0
- `-25–0%`: linear 0–8
- `0–20%`: linear 8–16
- `20–40%`: linear 16–20
- `>= 40%`: 20

With no income and no expenses, contribution is 10 (neutral). With expenses but no income, it is 0.

Savings health rewards retained income while cash-flow position makes negative flow visible. They are related intentionally but have separate explanations and capped influence.

## 3. Recent spending velocity — 0 to 15

Compare average daily expense in the current local day plus the preceding 6 local calendar days with the prior 21 days. Including the current day makes the pulse responsive; the UI labels this as a recent velocity, not a completed-week comparison.

- ratio `<= 1`: 15
- `1–1.5`: linear 15–9
- `1.5–2.5`: linear 9–0
- `>= 2.5`: 0

If the preceding window contains no expense or fewer than 14 days of ledger history, contribution is 8 (neutral) and the component is labelled `INSUFFICIENT_BASELINE`.

## 4. Behaviour anomaly load — 0 to 20

Start at 20. For reliable current-period flagged expenses:

- subtract 5 per `UNUSUAL` score (`60–79`);
- subtract 10 per `HIGH` score (`80–100`);
- clamp at 0.

`LOW` confidence signals and scores below 60 do not reduce this component.

## 5. Category concentration — 0 to 15

Use the Herfindahl–Hirschman Index over current-period expense category shares:

`HHI = sum(categoryShare²)`

- HHI `<= 0.30`: 15
- `0.30–0.50`: linear 15–8
- `0.50–0.75`: linear 8–2
- `> 0.75`: linear 2–0, reaching 0 at 1.0

No current-period expenses receive a neutral 8 and an `NO_EXPENSE_DATA` label. Concentration describes dependency on one spending category; it does not claim that diversified spending is always desirable.

## Labels

- `0–39`: under pressure
- `40–59`: needs attention
- `60–79`: steady
- `80–100`: strong

Empty-ledger neutral contributions sum to 61. The API overrides the label to `Building baseline` so the user is not told their finances are “steady” without data.
