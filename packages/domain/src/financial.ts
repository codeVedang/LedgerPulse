import { decimal, money, percentage, sum } from './money';
import type { CategoryTotal, LedgerObservation, LedgerSummary } from './types';

export function calculateSummary(transactions: readonly LedgerObservation[]): LedgerSummary {
  const income = sum(
    transactions.filter((item) => item.type === 'INCOME').map((item) => item.amount),
  );
  const expenses = sum(
    transactions.filter((item) => item.type === 'EXPENSE').map((item) => item.amount),
  );
  const netCashFlow = income.minus(expenses);
  const categoryAmounts = new Map<string, { categoryName: string; amount: ReturnType<typeof decimal> }>();
  for (const transaction of transactions.filter((item) => item.type === 'EXPENSE')) {
    const current = categoryAmounts.get(transaction.categoryId);
    categoryAmounts.set(transaction.categoryId, {
      categoryName: transaction.categoryName,
      amount: (current?.amount ?? decimal(0)).plus(transaction.amount),
    });
  }
  const categoryBreakdown: CategoryTotal[] = [...categoryAmounts.entries()]
    .map(([categoryId, value]) => ({
      categoryId,
      categoryName: value.categoryName,
      amount: money(value.amount),
      share: expenses.isZero() ? '0.00' : percentage(value.amount.dividedBy(expenses).times(100)),
    }))
    .sort((left, right) => decimal(right.amount).comparedTo(left.amount));
  const reliableAnomalyCount = transactions.filter(
    (item) =>
      item.type === 'EXPENSE' &&
      (item.anomalyScore ?? 0) >= 60 &&
      item.anomalyConfidence !== undefined &&
      item.anomalyConfidence !== 'LOW',
  ).length;

  return {
    income: money(income),
    expenses: money(expenses),
    netCashFlow: money(netCashFlow),
    savingsRate: income.isZero()
      ? null
      : percentage(netCashFlow.dividedBy(income).times(100)),
    transactionCount: transactions.length,
    reliableAnomalyCount,
    categoryBreakdown,
  };
}
