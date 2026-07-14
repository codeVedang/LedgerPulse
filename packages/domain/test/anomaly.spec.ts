import { analyseBehaviour, type LedgerObservation } from '../src';

const DAY = 86_400_000;
const baseTime = Date.parse('2026-07-13T12:00:00.000Z');

function expense(
  daysBefore: number,
  amount = '600.00',
  categoryId = 'food',
  categoryName = 'Food',
  hourOffset = 0,
): LedgerObservation {
  return {
    type: 'EXPENSE',
    amount,
    currency: 'INR',
    categoryId,
    categoryName,
    transactionDate: new Date(baseTime - daysBefore * DAY + hourOffset * 60 * 60 * 1000).toISOString(),
  };
}

const candidate = (amount = '600.00', hourOffset = 0): LedgerObservation =>
  expense(0, amount, 'food', 'Food', hourOffset);

describe('Behaviour Fingerprint engine', () => {
  it('is honest about insufficient history', () => {
    const result = analyseBehaviour({ candidate: candidate('8500.00'), history: [], timezone: 'Asia/Kolkata' });

    expect(result.confidence).toBe('LOW');
    expect(result.flagged).toBe(false);
    expect(result.reasons[0]?.code).toBe('INSUFFICIENT_BASELINE');
  });

  it('detects a category amount outlier against the median', () => {
    const history = [35, 28, 21, 14, 7, 3].map((days, index) =>
      expense(days, ['580.00', '620.00', '600.00', '610.00', '590.00', '605.00'][index]),
    );
    const result = analyseBehaviour({ candidate: candidate('8500.00'), history, timezone: 'Asia/Kolkata' });

    expect(result.confidence).toBe('MEDIUM');
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CATEGORY_AMOUNT_DEVIATION', points: 35 })]),
    );
    expect(result.expectedBehaviour.amountRange?.sampleSize).toBe(6);
  });

  it('uses MAD when enough non-uniform category history exists', () => {
    const amounts = ['450.00', '480.00', '500.00', '510.00', '520.00', '540.00', '560.00', '590.00'];
    const history = amounts.map((amount, index) => expense(42 - index * 5, amount));
    const result = analyseBehaviour({ candidate: candidate('1800.00'), history, timezone: 'Asia/Kolkata' });

    const madReason = result.reasons.find((reason) => reason.code === 'ROBUST_MAD_DEVIATION');
    expect(madReason?.points).toBeGreaterThan(0);
    expect(madReason?.evidence.medianAbsoluteDeviation).toBeDefined();
  });

  it('detects category velocity against historical rolling windows', () => {
    const old = [30, 25, 20, 15, 10, 8, 6, 4, 2].map((days) => expense(days));
    const nearCandidate = [expense(0, '600.00', 'food', 'Food', -2), expense(0, '600.00', 'food', 'Food', -1)];
    const result = analyseBehaviour({
      candidate: candidate(),
      history: [...old, ...nearCandidate],
      timezone: 'Asia/Kolkata',
    });

    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CATEGORY_VELOCITY' })]),
    );
  });

  it('detects a rolling category spending spike', () => {
    const history: LedgerObservation[] = [];
    for (let week = 1; week <= 4; week += 1) {
      history.push(expense(week * 7 + 2, '200.00'));
    }
    history.push(...[42, 40, 38, 36, 34, 32].map((days) => expense(days, '200.00')));
    history.push(expense(2, '900.00'));
    const result = analyseBehaviour({ candidate: candidate('900.00'), history, timezone: 'Asia/Kolkata' });

    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CATEGORY_SPENDING_SPIKE', points: 15 })]),
    );
  });

  it('detects an unusual local time with 12 observations across 12 distinct local dates', () => {
    const history = Array.from({ length: 12 }, (_, index) => expense(12 - index));
    const result = analyseBehaviour({
      candidate: candidate('600.00', 10),
      history,
      timezone: 'Asia/Kolkata',
    });

    const timeReason = result.reasons.find((reason) => reason.code === 'UNUSUAL_LOCAL_TIME');
    expect(timeReason?.points).toBe(10);
    expect(timeReason?.evidence.sampleSize).toBe(12);
    expect(timeReason?.evidence.distinctLocalDates).toBe(12);
    expect(timeReason?.evidence.supportPercent).toBe(0);
  });

  it('does not evaluate local time without 12 distinct local dates', () => {
    const history = [
      ...Array.from({ length: 11 }, (_, index) => expense(11 - index)),
      expense(1, '600.00', 'food', 'Food', 1),
    ];
    const result = analyseBehaviour({
      candidate: candidate('600.00', 10),
      history,
      timezone: 'Asia/Kolkata',
    });

    expect(history).toHaveLength(12);
    expect(result.reasons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNUSUAL_LOCAL_TIME' })]),
    );
  });

  it('keeps a normal transaction unflagged with a mature baseline', () => {
    const history = Array.from({ length: 24 }, (_, index) => expense(48 - index * 2, '600.00'));
    const result = analyseBehaviour({ candidate: candidate('610.00'), history, timezone: 'Asia/Kolkata' });

    expect(result.confidence).toBe('HIGH');
    expect(result.score).toBeLessThan(30);
    expect(result.flagged).toBe(false);
  });

  it('clamps an extreme multi-signal outlier between 0 and 100', () => {
    const history = Array.from({ length: 20 }, (_, index) =>
      expense(45 - index * 2, index % 2 === 0 ? '450.00' : '550.00'),
    );
    const result = analyseBehaviour({ candidate: candidate('999999999999.99', 10), history, timezone: 'Asia/Kolkata' });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.severity).toBe('HIGH');
  });

  it('does not score income as anomalous expense behaviour', () => {
    const income: LedgerObservation = { ...candidate('10000.00'), type: 'INCOME' };
    const result = analyseBehaviour({ candidate: income, history: [], timezone: 'Asia/Kolkata' });

    expect(result.score).toBe(0);
    expect(result.reasons[0]?.code).toBe('INCOME_NOT_SCORED');
  });
});
