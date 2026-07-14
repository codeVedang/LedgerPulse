import type { ConfigService } from '@nestjs/config';
import { Prisma, TransactionType } from '@prisma/client';
import type { BehaviourAnalysis, FinancialPulse, LedgerSummary } from '@ledgerpulse/domain';
import type { AggregateCacheService } from '../cache/aggregate-cache.service';
import type { PrismaService } from '../database/prisma.service';
import type { DomainEventBus } from '../events/domain-event-bus.service';
import type { CreateTransactionDto } from './dto/transaction.dto';
import type { TransactionEvaluation, TransactionEvaluator } from './transaction-evaluator.service';
import { TransactionsService } from './transactions.service';

const userId = '00000000-0000-4000-8000-000000000001';
const categoryId = '10000000-0000-4000-8000-000000000003';
const key = '20000000-0000-4000-8000-000000000001';
const dto: CreateTransactionDto = {
  type: TransactionType.EXPENSE,
  amount: '600.00',
  currency: 'INR',
  categoryId,
  description: 'Lunch',
  transactionDate: '2026-07-10T08:00:00.000Z',
};

const analysis: BehaviourAnalysis = {
  engineVersion: 'behaviour-v1',
  score: 12,
  confidence: 'MEDIUM',
  severity: 'NORMAL',
  flagged: false,
  reasons: [{ code: 'NO_MATERIAL_DEVIATION', text: 'Within baseline.', points: 0, evidence: {} }],
  expectedBehaviour: {},
  baseline: { overallExpenseCount: 10, categoryExpenseCount: 5, historySpanDays: 20 },
};
const summary: LedgerSummary = {
  income: '1000.00', expenses: '600.00', netCashFlow: '400.00', savingsRate: '40.00',
  transactionCount: 1, reliableAnomalyCount: 0, categoryBreakdown: [],
};
const pulse: FinancialPulse = {
  score: 70, label: 'Steady', components: [],
  recentVelocity: { ratio: null, recentDailyAverage: '0.00', baselineDailyAverage: '0.00', status: 'INSUFFICIENT_BASELINE' },
  reliableAnomalyCount: 0, categoryConcentration: null,
};
const evaluation: TransactionEvaluation = {
  analysis,
  period: { start: '2026-07-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z' },
  before: { summary, pulse },
  after: { summary, pulse },
  categoryImpact: { categoryId, categoryName: 'Food', before: '0.00', after: '600.00', changePercent: null },
};

function row() {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    userId,
    categoryId,
    type: TransactionType.EXPENSE,
    amount: new Prisma.Decimal('600.00'),
    currency: 'INR',
    description: 'Lunch',
    transactionDate: new Date(dto.transactionDate),
    anomalyScore: 12,
    anomalyConfidence: 'MEDIUM' as const,
    anomalyVersion: 'behaviour-v1',
    anomalyAnalysis: analysis as unknown as Prisma.JsonValue,
    createdAt: new Date('2026-07-10T08:01:00.000Z'),
    updatedAt: new Date('2026-07-10T08:01:00.000Z'),
    category: { id: categoryId, name: 'Food', slug: 'food', color: '#D97757', isActive: true },
  };
}

function harness() {
  let record: { requestHash: string; transaction: ReturnType<typeof row> | null } | null = null;
  const storedRow = row();
  const tx = {
    idempotencyRecord: {
      findUnique: jest.fn(async () => record),
      create: jest.fn(async ({ data }: { data: { requestHash: string } }) => {
        record = { requestHash: data.requestHash, transaction: null };
        return record;
      }),
      update: jest.fn(async () => {
        if (record) record.transaction = storedRow;
        return record;
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: userId, timezone: 'Asia/Kolkata' }) },
    transaction: { create: jest.fn().mockResolvedValue(storedRow) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    idempotencyRecord: { findUnique: jest.fn(async () => record) },
  } as unknown as PrismaService;
  const evaluator = { evaluate: jest.fn().mockResolvedValue(evaluation) } as unknown as TransactionEvaluator;
  const cache = { invalidateUser: jest.fn().mockResolvedValue(undefined) } as unknown as AggregateCacheService;
  const events = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus;
  const config = { getOrThrow: jest.fn().mockReturnValue(userId) } as unknown as ConfigService;
  return { service: new TransactionsService(prisma, evaluator, cache, events, config), tx, prisma, cache, events };
}

describe('TransactionsService idempotency', () => {
  it('returns the original transaction for a repeated identical request', async () => {
    const { service, tx, cache, events } = harness();

    const first = await service.create(dto, key) as { idempotency: { replayed: boolean } };
    const second = await service.create(dto, key) as { idempotency: { replayed: boolean } };

    expect(first.idempotency.replayed).toBe(false);
    expect(second.idempotency.replayed).toBe(true);
    expect(tx.transaction.create.mock.calls).toHaveLength(1);
    const invalidateUser = cache.invalidateUser as jest.Mock;
    const publish = events.publish as jest.Mock;
    expect(invalidateUser.mock.calls).toHaveLength(1);
    expect(publish.mock.calls).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key with a changed semantic payload', async () => {
    const { service } = harness();
    await service.create(dto, key);

    await expect(service.create({ ...dto, amount: '601.00' }, key)).rejects.toMatchObject({ status: 409 });
  });

  it('resolves a concurrent uniqueness race by returning the committed winner', async () => {
    const storedRow = row();
    let calls = 0;
    const prisma = {
      $transaction: jest.fn(async () => {
        calls += 1;
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002', clientVersion: '6.19.3', meta: { target: ['userId', 'key', 'operation'] },
        });
      }),
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: 'a9383d596c61dbd631c29d7735bde752a0352a25ae62d71ec0cfe856033987f6',
          transaction: storedRow,
        }),
      },
    } as unknown as PrismaService;
    const evaluator = { evaluate: jest.fn() } as unknown as TransactionEvaluator;
    const cache = { invalidateUser: jest.fn() } as unknown as AggregateCacheService;
    const events = { publish: jest.fn() } as unknown as DomainEventBus;
    const config = { getOrThrow: jest.fn().mockReturnValue(userId) } as unknown as ConfigService;
    const service = new TransactionsService(prisma, evaluator, cache, events, config);

    const response = await service.create(dto, key) as { idempotency: { replayed: boolean } };
    expect(response.idempotency.replayed).toBe(true);
    expect(calls).toBe(1);
  });
});

describe('TransactionsService response contract', () => {
  it('wraps a transaction detail in the standard data envelope', async () => {
    const storedRow = row();
    const prisma = {
      transaction: { findFirst: jest.fn().mockResolvedValue(storedRow) },
    } as unknown as PrismaService;
    const evaluator = { evaluate: jest.fn() } as unknown as TransactionEvaluator;
    const cache = { invalidateUser: jest.fn() } as unknown as AggregateCacheService;
    const events = { publish: jest.fn() } as unknown as DomainEventBus;
    const config = { getOrThrow: jest.fn().mockReturnValue(userId) } as unknown as ConfigService;
    const service = new TransactionsService(prisma, evaluator, cache, events, config);

    await expect(service.get(storedRow.id)).resolves.toMatchObject({ data: { id: storedRow.id } });
  });
});
