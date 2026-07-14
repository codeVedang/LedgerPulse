import type { Prisma } from '@prisma/client';
import type { LedgerObservation } from '@ledgerpulse/domain';

export const transactionInclude = {
  category: { select: { id: true, name: true, slug: true, color: true, isActive: true } },
} satisfies Prisma.TransactionInclude;

export type TransactionWithCategory = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export function toObservation(row: TransactionWithCategory): LedgerObservation {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount.toFixed(2),
    currency: 'INR',
    categoryId: row.categoryId,
    categoryName: row.category.name,
    transactionDate: row.transactionDate.toISOString(),
    ...(row.anomalyScore !== null ? { anomalyScore: row.anomalyScore } : {}),
    ...(row.anomalyConfidence !== null ? { anomalyConfidence: row.anomalyConfidence } : {}),
  };
}

export function toTransactionResponse(row: TransactionWithCategory): object {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount.toFixed(2),
    currency: row.currency.trim(),
    description: row.description,
    transactionDate: row.transactionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    anomaly: {
      score: row.anomalyScore ?? 0,
      confidence: row.anomalyConfidence ?? 'LOW',
      engineVersion: row.anomalyVersion,
      analysis: row.anomalyAnalysis,
    },
  };
}
