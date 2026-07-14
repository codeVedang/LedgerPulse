import { decimal, linear, median, medianAbsoluteDeviation, money, percentile, roundContribution, sum } from './money';
import { circularHourDistance, localDateKey, localParts } from './time';
import type {
  AnomalyReason,
  AnomalySeverity,
  BehaviourAnalysis,
  Confidence,
  ExpectedBehaviour,
  LedgerObservation,
} from './types';

const THREE_HOURS = 3 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const MIN_TIME_PATTERN_OBSERVATIONS = 12;
const MIN_TIME_PATTERN_DISTINCT_DATES = 12;

function componentAmountRatio(ratio: number): number {
  if (ratio < 1.5) return 0;
  if (ratio < 2) return linear(ratio, 1.5, 2, 5, 12);
  if (ratio < 4) return linear(ratio, 2, 4, 12, 25);
  if (ratio < 8) return linear(ratio, 4, 8, 25, 32);
  return 35;
}

function componentMad(z: number): number {
  if (z <= 2.5) return 0;
  if (z < 3.5) return linear(z, 2.5, 3.5, 4, 10);
  if (z < 6) return linear(z, 3.5, 6, 10, 18);
  return 20;
}

function componentTime(support: number): number {
  if (support >= 0.15) return 0;
  if (support >= 0.08) return linear(support, 0.08, 0.15, 7, 3);
  return 10;
}

function componentSpike(ratio: number): number {
  if (ratio < 1.5) return 0;
  if (ratio < 2) return linear(ratio, 1.5, 2, 4, 8);
  if (ratio < 3) return linear(ratio, 2, 3, 8, 12);
  return 15;
}

function severity(score: number): AnomalySeverity {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'UNUSUAL';
  if (score >= 30) return 'WATCH';
  return 'NORMAL';
}

function confidence(overall: number, category: number, spanDays: number): Confidence {
  if (overall >= 20 && category >= 8 && spanDays >= 28) return 'HIGH';
  if (overall >= 6 && category >= 5 && spanDays >= 7) return 'MEDIUM';
  return 'LOW';
}

function expectedBehaviour(
  categoryHistory: readonly LedgerObservation[],
  timezone: string,
): ExpectedBehaviour {
  if (categoryHistory.length < 3) return {};
  const amounts = categoryHistory.map((item) => item.amount);
  const low = percentile(amounts, 0.25)!;
  const high = percentile(amounts, 0.75)!;
  const dailyCounts = new Map<string, number>();
  for (const transaction of categoryHistory) {
    const date = localDateKey(transaction.transactionDate, timezone);
    dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
  }
  const counts = [...dailyCounts.values()];
  const frequencyLow = percentile(counts, 0.25)!;
  const frequencyHigh = percentile(counts, 0.75)!;
  return {
    amountRange: { low: money(low), high: money(high), sampleSize: categoryHistory.length },
    dailyFrequencyRange: {
      low: Math.max(1, Math.floor(frequencyLow.toNumber())),
      high: Math.max(1, Math.ceil(frequencyHigh.toNumber())),
      activeDays: counts.length,
    },
  };
}

function p95Count(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
}

export interface AnalyseBehaviourInput {
  candidate: LedgerObservation;
  history: readonly LedgerObservation[];
  timezone: string;
}

export function analyseBehaviour({ candidate, history, timezone }: AnalyseBehaviourInput): BehaviourAnalysis {
  if (candidate.type === 'INCOME') {
    return {
      engineVersion: 'behaviour-v1',
      score: 0,
      confidence: 'LOW',
      severity: 'NORMAL',
      flagged: false,
      reasons: [
        {
          code: 'INCOME_NOT_SCORED',
          text: 'Behaviour Fingerprint currently evaluates expense behaviour only.',
          points: 0,
          evidence: {},
        },
      ],
      expectedBehaviour: {},
      baseline: { overallExpenseCount: 0, categoryExpenseCount: 0, historySpanDays: 0 },
    };
  }

  const candidateTime = new Date(candidate.transactionDate).getTime();
  const expenseHistory = history
    .filter(
      (item) =>
        item.type === 'EXPENSE' &&
        item.currency === candidate.currency &&
        new Date(item.transactionDate).getTime() < candidateTime,
    )
    .sort(
      (left, right) =>
        new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime(),
    );
  const categoryHistory = expenseHistory.filter((item) => item.categoryId === candidate.categoryId);
  const earliest = expenseHistory[0];
  const spanDays = earliest
    ? Math.max(0, Math.floor((candidateTime - new Date(earliest.transactionDate).getTime()) / DAY))
    : 0;
  const analysisConfidence = confidence(expenseHistory.length, categoryHistory.length, spanDays);
  const reasons: AnomalyReason[] = [];
  let total = 0;

  if (categoryHistory.length >= 3) {
    const categoryMedian = median(categoryHistory.map((item) => item.amount))!;
    if (categoryMedian.greaterThan(0)) {
      const ratio = decimal(candidate.amount).dividedBy(categoryMedian);
      const points = roundContribution(componentAmountRatio(ratio.toNumber()));
      total += points;
      if (points > 0) {
        reasons.push({
          code: 'CATEGORY_AMOUNT_DEVIATION',
          text: `This amount is ${ratio.toDecimalPlaces(1).toFixed(1)}× your typical ${candidate.categoryName} transaction.`,
          points,
          evidence: {
            ratio: ratio.toDecimalPlaces(2).toFixed(2),
            categoryMedian: money(categoryMedian),
            sampleSize: categoryHistory.length,
          },
        });
      }
    }
  }

  if (categoryHistory.length >= 8) {
    const amounts = categoryHistory.map((item) => item.amount);
    const categoryMedian = median(amounts)!;
    const mad = medianAbsoluteDeviation(amounts)!;
    if (!mad.isZero()) {
      const robustZ = decimal(candidate.amount)
        .minus(categoryMedian)
        .abs()
        .times('0.6745')
        .dividedBy(mad);
      const points = roundContribution(componentMad(robustZ.toNumber()));
      total += points;
      if (points > 0) {
        reasons.push({
          code: 'ROBUST_MAD_DEVIATION',
          text: `The amount is ${robustZ.toDecimalPlaces(1).toFixed(1)} robust deviations from your category median.`,
          points,
          evidence: {
            robustZ: robustZ.toDecimalPlaces(2).toFixed(2),
            medianAbsoluteDeviation: money(mad),
            sampleSize: categoryHistory.length,
          },
        });
      }
    }
  }

  if (expenseHistory.length >= 10 && categoryHistory.length >= 5 && spanDays >= 7) {
    const historicalWindowCounts = categoryHistory.map((anchor) => {
      const anchorTime = new Date(anchor.transactionDate).getTime();
      return categoryHistory.filter((item) => {
        const itemTime = new Date(item.transactionDate).getTime();
        return itemTime <= anchorTime && itemTime >= anchorTime - THREE_HOURS;
      }).length;
    });
    const baseline = Math.max(2, p95Count(historicalWindowCounts));
    const candidateCount =
      categoryHistory.filter((item) => {
        const time = new Date(item.transactionDate).getTime();
        return time >= candidateTime - THREE_HOURS && time < candidateTime;
      }).length + 1;
    const excess = candidateCount - baseline;
    const points = excess <= 0 ? 0 : excess === 1 ? 6 : excess === 2 ? 10 : 15;
    total += points;
    if (points > 0) {
      reasons.push({
        code: 'CATEGORY_VELOCITY',
        text: `You made ${candidateCount} ${candidate.categoryName} transactions within 3 hours; your historical high-water mark is ${baseline}.`,
        points,
        evidence: { candidateCount, historicalP95: p95Count(historicalWindowCounts), threshold: baseline },
      });
    }
  }

  const distinctLocalDates = new Set(
    categoryHistory.map((item) => localDateKey(item.transactionDate, timezone)),
  ).size;
  if (
    categoryHistory.length >= MIN_TIME_PATTERN_OBSERVATIONS &&
    distinctLocalDates >= MIN_TIME_PATTERN_DISTINCT_DATES
  ) {
    const candidateHour = localParts(candidate.transactionDate, timezone).hour;
    const supported = categoryHistory.filter(
      (item) =>
        circularHourDistance(localParts(item.transactionDate, timezone).hour, candidateHour) <= 2,
    ).length;
    const support = supported / categoryHistory.length;
    const points = roundContribution(componentTime(support));
    total += points;
    if (points > 0) {
      reasons.push({
        code: 'UNUSUAL_LOCAL_TIME',
        text: `Only ${Math.round(support * 100)}% of your ${candidate.categoryName} history occurs near this local time.`,
        points,
        evidence: {
          localHour: candidateHour,
          supportPercent: Math.round(support * 100),
          sampleSize: categoryHistory.length,
          distinctLocalDates,
        },
      });
    }
  }

  if (spanDays >= 28) {
    const recent = sum(
      categoryHistory
        .filter((item) => {
          const time = new Date(item.transactionDate).getTime();
          return time >= candidateTime - 7 * DAY && time < candidateTime;
        })
        .map((item) => item.amount),
    ).plus(candidate.amount);
    const priorWindows = [1, 2, 3, 4].map((window) =>
      sum(
        categoryHistory
          .filter((item) => {
            const time = new Date(item.transactionDate).getTime();
            const end = candidateTime - window * 7 * DAY;
            return time >= end - 7 * DAY && time < end;
          })
          .map((item) => item.amount),
      ),
    );
    const baseline = median(priorWindows)!;
    if (baseline.greaterThan(0)) {
      const ratio = recent.dividedBy(baseline);
      const points = roundContribution(componentSpike(ratio.toNumber()));
      total += points;
      if (points > 0) {
        reasons.push({
          code: 'CATEGORY_SPENDING_SPIKE',
          text: `Your 7-day ${candidate.categoryName} spending is ${ratio.toDecimalPlaces(1).toFixed(1)}× its recent weekly baseline.`,
          points,
          evidence: {
            ratio: ratio.toDecimalPlaces(2).toFixed(2),
            recentSpend: money(recent),
            weeklyMedian: money(baseline),
          },
        });
      }
    }
  }

  if (expenseHistory.length >= 10 && categoryHistory.length === 0) {
    total += 15;
    reasons.push({
      code: 'NEW_CATEGORY_BEHAVIOUR',
      text: `${candidate.categoryName} is new compared with your established expense history.`,
      points: 15,
      evidence: { overallExpenseCount: expenseHistory.length },
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));
  if (analysisConfidence === 'LOW') {
    reasons.unshift({
      code: 'INSUFFICIENT_BASELINE',
      text: 'A reliable behavioural baseline has not yet been established. Treat this score as provisional.',
      points: 0,
      evidence: {
        overallExpenseCount: expenseHistory.length,
        categoryExpenseCount: categoryHistory.length,
        historySpanDays: spanDays,
      },
    });
  }
  if (reasons.length === 0) {
    reasons.push({
      code: 'NO_MATERIAL_DEVIATION',
      text: 'This transaction is within the behaviour ranges supported by your history.',
      points: 0,
      evidence: {},
    });
  }

  return {
    engineVersion: 'behaviour-v1',
    score,
    confidence: analysisConfidence,
    severity: severity(score),
    flagged: score >= 60 && analysisConfidence !== 'LOW',
    reasons,
    expectedBehaviour: expectedBehaviour(categoryHistory, timezone),
    baseline: {
      overallExpenseCount: expenseHistory.length,
      categoryExpenseCount: categoryHistory.length,
      historySpanDays: spanDays,
    },
  };
}
