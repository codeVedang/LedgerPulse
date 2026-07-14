import { decimal, linear, money, percentage, roundContribution, sum } from './money';
import { localDayOrdinal } from './time';
import type {
  FinancialPulse,
  LedgerObservation,
  LedgerSummary,
  PulseComponent,
  PulseComponentStatus,
} from './types';

function savingsComponent(summary: LedgerSummary): PulseComponent {
  const income = decimal(summary.income);
  const expenses = decimal(summary.expenses);
  if (income.isZero()) {
    const empty = expenses.isZero();
    return {
      key: 'savingsHealth',
      label: 'Savings health',
      contribution: empty ? 15 : 0,
      maximum: 30,
      explanation: empty
        ? 'No income or expenses yet; this component stays neutral while the baseline forms.'
        : 'Savings rate is undefined because no income was recorded while expenses were present.',
      status: 'INSUFFICIENT_BASELINE',
      raw: { savingsRate: null },
    };
  }
  const rate = decimal(summary.netCashFlow).dividedBy(income).times(100).toNumber();
  const contribution =
    rate <= 0 ? 0 : rate < 20 ? linear(rate, 0, 20, 0, 24) : rate < 40 ? linear(rate, 20, 40, 24, 30) : 30;
  return {
    key: 'savingsHealth',
    label: 'Savings health',
    contribution: roundContribution(contribution),
    maximum: 30,
    explanation: `A ${percentage(rate)}% savings rate contributes ${roundContribution(contribution)} of 30 points.`,
    status: 'MEASURED',
    raw: { savingsRate: percentage(rate) },
  };
}

function cashFlowComponent(summary: LedgerSummary): PulseComponent {
  const income = decimal(summary.income);
  const expenses = decimal(summary.expenses);
  if (income.isZero()) {
    const empty = expenses.isZero();
    return {
      key: 'cashFlow',
      label: 'Cash-flow position',
      contribution: empty ? 10 : 0,
      maximum: 20,
      explanation: empty
        ? 'No cash-flow evidence yet; this component stays neutral.'
        : 'Expenses without recorded income put current cash flow under pressure.',
      status: 'INSUFFICIENT_BASELINE',
      raw: { netToIncomeRatio: null, netCashFlow: summary.netCashFlow },
    };
  }
  const ratio = decimal(summary.netCashFlow).dividedBy(income).times(100).toNumber();
  let value = 0;
  if (ratio > -25 && ratio < 0) value = linear(ratio, -25, 0, 0, 8);
  else if (ratio >= 0 && ratio < 20) value = linear(ratio, 0, 20, 8, 16);
  else if (ratio >= 20 && ratio < 40) value = linear(ratio, 20, 40, 16, 20);
  else if (ratio >= 40) value = 20;
  return {
    key: 'cashFlow',
    label: 'Cash-flow position',
    contribution: roundContribution(value),
    maximum: 20,
    explanation: `Net cash flow is ${percentage(ratio)}% of income, contributing ${roundContribution(value)} of 20 points.`,
    status: 'MEASURED',
    raw: { netToIncomeRatio: percentage(ratio), netCashFlow: summary.netCashFlow },
  };
}

interface VelocityResult {
  component: PulseComponent;
  ratio: string | null;
  recentDailyAverage: string;
  baselineDailyAverage: string;
  status: PulseComponentStatus;
}

function velocityComponent(
  allTransactions: readonly LedgerObservation[],
  asOf: string,
  timezone: string,
): VelocityResult {
  const asOfDay = localDayOrdinal(asOf, timezone);
  const expenses = allTransactions.filter((item) => item.type === 'EXPENSE');
  const ordinals = expenses.map((item) => localDayOrdinal(item.transactionDate, timezone));
  const earliest = ordinals.length > 0 ? Math.min(...ordinals) : asOfDay;
  const historyDays = Math.max(0, asOfDay - earliest);
  const recent = sum(
    expenses
      .filter((item) => {
        const difference = asOfDay - localDayOrdinal(item.transactionDate, timezone);
        return difference >= 0 && difference <= 6;
      })
      .map((item) => item.amount),
  );
  const baseline = sum(
    expenses
      .filter((item) => {
        const difference = asOfDay - localDayOrdinal(item.transactionDate, timezone);
        return difference >= 7 && difference <= 27;
      })
      .map((item) => item.amount),
  );
  const recentDaily = recent.dividedBy(7);
  const baselineDaily = baseline.dividedBy(21);
  if (historyDays < 14 || baseline.isZero()) {
    return {
      component: {
        key: 'spendingVelocity',
        label: 'Recent spending velocity',
        contribution: 8,
        maximum: 15,
        explanation: 'There is not enough prior spending evidence for a reliable 7-day velocity comparison.',
        status: 'INSUFFICIENT_BASELINE',
        raw: { ratio: null, historyDays },
      },
      ratio: null,
      recentDailyAverage: money(recentDaily),
      baselineDailyAverage: money(baselineDaily),
      status: 'INSUFFICIENT_BASELINE',
    };
  }
  const ratio = recentDaily.dividedBy(baselineDaily).toNumber();
  const value =
    ratio <= 1 ? 15 : ratio < 1.5 ? linear(ratio, 1, 1.5, 15, 9) : ratio < 2.5 ? linear(ratio, 1.5, 2.5, 9, 0) : 0;
  return {
    component: {
      key: 'spendingVelocity',
      label: 'Recent spending velocity',
      contribution: roundContribution(value),
      maximum: 15,
      explanation: `Recent daily spending is ${percentage(ratio * 100)}% of the preceding baseline.`,
      status: 'MEASURED',
      raw: { ratio: percentage(ratio), historyDays },
    },
    ratio: percentage(ratio),
    recentDailyAverage: money(recentDaily),
    baselineDailyAverage: money(baselineDaily),
    status: 'MEASURED',
  };
}

function anomalyComponent(current: readonly LedgerObservation[]): PulseComponent {
  const unusual = current.filter(
    (item) => item.anomalyConfidence !== 'LOW' && (item.anomalyScore ?? 0) >= 60 && (item.anomalyScore ?? 0) < 80,
  ).length;
  const high = current.filter(
    (item) => item.anomalyConfidence !== 'LOW' && (item.anomalyScore ?? 0) >= 80,
  ).length;
  const contribution = Math.max(0, 20 - unusual * 5 - high * 10);
  return {
    key: 'anomalyLoad',
    label: 'Behaviour anomaly load',
    contribution,
    maximum: 20,
    explanation:
      unusual + high === 0
        ? 'No reliable behavioural anomalies reduced this component.'
        : `${unusual} unusual and ${high} high anomaly event(s) reduced this component.`,
    status: 'MEASURED',
    raw: { unusualCount: unusual, highCount: high },
  };
}

function concentrationComponent(summary: LedgerSummary): { component: PulseComponent; hhi: string | null } {
  if (decimal(summary.expenses).isZero()) {
    return {
      component: {
        key: 'concentration',
        label: 'Category concentration',
        contribution: 8,
        maximum: 15,
        explanation: 'No expense categories are available, so this component stays neutral.',
        status: 'NO_EXPENSE_DATA',
        raw: { hhi: null },
      },
      hhi: null,
    };
  }
  const expenses = decimal(summary.expenses);
  const hhiDecimal = sum(
    summary.categoryBreakdown.map((category) => decimal(category.amount).dividedBy(expenses).pow(2)),
  );
  const hhi = hhiDecimal.toNumber();
  const value =
    hhi <= 0.3
      ? 15
      : hhi <= 0.5
        ? linear(hhi, 0.3, 0.5, 15, 8)
        : hhi <= 0.75
          ? linear(hhi, 0.5, 0.75, 8, 2)
          : linear(hhi, 0.75, 1, 2, 0);
  const contribution = roundContribution(value);
  return {
    component: {
      key: 'concentration',
      label: 'Category concentration',
      contribution,
      maximum: 15,
      explanation: `The expense-category concentration index is ${hhiDecimal.toDecimalPlaces(2).toFixed(2)}.`,
      status: 'MEASURED',
      raw: { hhi: hhiDecimal.toDecimalPlaces(4).toFixed(4) },
    },
    hhi: hhiDecimal.toDecimalPlaces(4).toFixed(4),
  };
}

function pulseLabel(score: number, empty: boolean): FinancialPulse['label'] {
  if (empty) return 'Building baseline';
  if (score < 40) return 'Under pressure';
  if (score < 60) return 'Needs attention';
  if (score < 80) return 'Steady';
  return 'Strong';
}

export interface CalculatePulseInput {
  currentTransactions: readonly LedgerObservation[];
  allTransactions: readonly LedgerObservation[];
  summary: LedgerSummary;
  asOf: string;
  timezone: string;
}

export function calculatePulse(input: CalculatePulseInput): FinancialPulse {
  const savings = savingsComponent(input.summary);
  const cashFlow = cashFlowComponent(input.summary);
  const velocity = velocityComponent(input.allTransactions, input.asOf, input.timezone);
  const anomaly = anomalyComponent(input.currentTransactions);
  const concentration = concentrationComponent(input.summary);
  const components = [savings, cashFlow, velocity.component, anomaly, concentration.component];
  const score = Math.max(
    0,
    Math.min(100, components.reduce((total, component) => total + component.contribution, 0)),
  );
  return {
    score,
    label: pulseLabel(score, input.allTransactions.length === 0),
    components,
    recentVelocity: {
      ratio: velocity.ratio,
      recentDailyAverage: velocity.recentDailyAverage,
      baselineDailyAverage: velocity.baselineDailyAverage,
      status: velocity.status,
    },
    reliableAnomalyCount: input.summary.reliableAnomalyCount,
    categoryConcentration: concentration.hhi,
  };
}
