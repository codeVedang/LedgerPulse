import { calculateSummary, type LedgerObservation } from '../src';

function observation(type: 'INCOME' | 'EXPENSE', amount: string, categoryId = 'general'): LedgerObservation {
  return {
    type,
    amount,
    currency: 'INR',
    categoryId,
    categoryName: categoryId,
    transactionDate: '2026-07-01T10:00:00.000Z',
  };
}

describe('financial calculations', () => {
  it('calculates savings rate with decimal arithmetic', () => {
    const result = calculateSummary([
      observation('INCOME', '10000.00', 'salary'),
      observation('EXPENSE', '2500.00', 'food'),
    ]);

    expect(result.netCashFlow).toBe('7500.00');
    expect(result.savingsRate).toBe('75.00');
  });

  it('returns null rather than division by zero for zero income', () => {
    const result = calculateSummary([observation('EXPENSE', '50.00', 'food')]);

    expect(result.savingsRate).toBeNull();
    expect(result.netCashFlow).toBe('-50.00');
  });

  it('preserves decimal precision for 0.10 + 0.20', () => {
    const result = calculateSummary([
      observation('EXPENSE', '0.10', 'food'),
      observation('EXPENSE', '0.20', 'food'),
    ]);

    expect(result.expenses).toBe('0.30');
    expect(result.categoryBreakdown[0]?.amount).toBe('0.30');
  });

  it('represents negative net cash flow exactly', () => {
    const result = calculateSummary([
      observation('INCOME', '10.00', 'salary'),
      observation('EXPENSE', '10.01', 'food'),
    ]);

    expect(result.netCashFlow).toBe('-0.01');
    expect(result.savingsRate).toBe('-0.10');
  });
});
