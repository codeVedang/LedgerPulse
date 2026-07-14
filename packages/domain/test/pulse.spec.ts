import { calculatePulse, calculateSummary, type LedgerObservation } from '../src';

function transaction(
  type: 'INCOME' | 'EXPENSE',
  amount: string,
  date: string,
  categoryId = 'food',
): LedgerObservation {
  return { type, amount, transactionDate: date, categoryId, categoryName: categoryId, currency: 'INR' };
}

describe('Financial Pulse', () => {
  it('labels an empty ledger as building a baseline', () => {
    const summary = calculateSummary([]);
    const pulse = calculatePulse({
      summary,
      currentTransactions: [],
      allTransactions: [],
      asOf: '2026-07-13T12:00:00.000Z',
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.score).toBe(61);
    expect(pulse.label).toBe('Building baseline');
    expect(pulse.components.reduce((total, item) => total + item.contribution, 0)).toBe(pulse.score);
  });

  it('does not penalize low-confidence anomaly scores', () => {
    const item = {
      ...transaction('EXPENSE', '100.00', '2026-07-12T12:00:00.000Z'),
      anomalyScore: 99,
      anomalyConfidence: 'LOW' as const,
    };
    const current = [transaction('INCOME', '1000.00', '2026-07-01T12:00:00.000Z', 'salary'), item];
    const pulse = calculatePulse({
      summary: calculateSummary(current),
      currentTransactions: current,
      allTransactions: current,
      asOf: '2026-07-13T12:00:00.000Z',
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.components.find((component) => component.key === 'anomalyLoad')?.contribution).toBe(20);
  });

  it('calculates concentration from exact category amounts rather than rounded shares', () => {
    const current = [
      transaction('INCOME', '10.00', '2026-07-01T12:00:00.000Z', 'salary'),
      transaction('EXPENSE', '0.01', '2026-07-10T12:00:00.000Z', 'food'),
      transaction('EXPENSE', '0.02', '2026-07-11T12:00:00.000Z', 'transport'),
    ];
    const pulse = calculatePulse({
      summary: calculateSummary(current),
      currentTransactions: current,
      allTransactions: current,
      asOf: '2026-07-13T12:00:00.000Z',
      timezone: 'Asia/Kolkata',
    });

    expect(pulse.categoryConcentration).toBe('0.5556');
  });
});
