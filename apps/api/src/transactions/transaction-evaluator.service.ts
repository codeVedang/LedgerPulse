import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TransactionType, type User } from '@prisma/client';
import {
  analyseBehaviour,
  calculatePulse,
  calculateSummary,
  decimal,
  money,
  percentage,
  type BehaviourAnalysis,
  type LedgerObservation,
  type LedgerSummary,
} from '@ledgerpulse/domain';
import { monthBounds } from '../common/period';
import { toObservation, transactionInclude } from './transaction.mapper';

export interface NormalizedCandidate {
  type: TransactionType;
  amount: string;
  currency: 'INR';
  categoryId: string;
  description?: string;
  transactionDate: string;
}

export interface TransactionEvaluation {
  analysis: BehaviourAnalysis;
  period: { start: string; end: string };
  before: { summary: LedgerSummary; pulse: ReturnType<typeof calculatePulse> };
  after: { summary: LedgerSummary; pulse: ReturnType<typeof calculatePulse> };
  categoryImpact: {
    categoryId: string;
    categoryName: string;
    before: string;
    after: string;
    changePercent: string | null;
  };
}

@Injectable()
export class TransactionEvaluator {
  async evaluate(
    db: Prisma.TransactionClient,
    user: User,
    candidate: NormalizedCandidate,
    excludeId?: string,
  ): Promise<TransactionEvaluation> {
    const category = await db.category.findFirst({
      where: { id: candidate.categoryId, userId: user.id },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (!category.isActive) throw new BadRequestException('Inactive categories cannot receive transactions');
    if (category.type !== candidate.type) {
      throw new BadRequestException('Category type does not match transaction type');
    }

    const date = new Date(candidate.transactionDate);
    const bounds = monthBounds(date, user.timezone);
    const exclude = excludeId ? { not: excludeId } : undefined;
    const [historyRows, periodRows, allRows] = await Promise.all([
      db.transaction.findMany({
        where: {
          userId: user.id,
          type: 'EXPENSE',
          transactionDate: { lt: date },
          ...(exclude ? { id: exclude } : {}),
        },
        include: transactionInclude,
        orderBy: { transactionDate: 'asc' },
      }),
      db.transaction.findMany({
        where: {
          userId: user.id,
          transactionDate: { gte: bounds.start, lt: bounds.end },
          ...(exclude ? { id: exclude } : {}),
        },
        include: transactionInclude,
        orderBy: { transactionDate: 'asc' },
      }),
      db.transaction.findMany({
        where: { userId: user.id, ...(exclude ? { id: exclude } : {}) },
        include: transactionInclude,
        orderBy: { transactionDate: 'asc' },
      }),
    ]);
    const history = historyRows.map(toObservation);
    const period = periodRows.map(toObservation);
    const all = allRows.map(toObservation);
    const candidateObservation: LedgerObservation = {
      type: candidate.type,
      amount: candidate.amount,
      currency: candidate.currency,
      categoryId: category.id,
      categoryName: category.name,
      transactionDate: candidate.transactionDate,
    };
    const analysis = analyseBehaviour({ candidate: candidateObservation, history, timezone: user.timezone });
    const evaluatedCandidate: LedgerObservation = {
      ...candidateObservation,
      anomalyScore: analysis.score,
      anomalyConfidence: analysis.confidence,
    };
    const beforeSummary = calculateSummary(period);
    const afterTransactions = [...period, evaluatedCandidate];
    const afterSummary = calculateSummary(afterTransactions);
    const beforePulse = calculatePulse({
      currentTransactions: period,
      allTransactions: all,
      summary: beforeSummary,
      asOf: candidate.transactionDate,
      timezone: user.timezone,
    });
    const afterPulse = calculatePulse({
      currentTransactions: afterTransactions,
      allTransactions: [...all, evaluatedCandidate],
      summary: afterSummary,
      asOf: candidate.transactionDate,
      timezone: user.timezone,
    });
    const categoryBefore =
      beforeSummary.categoryBreakdown.find((item) => item.categoryId === category.id)?.amount ?? '0.00';
    const categoryAfter =
      afterSummary.categoryBreakdown.find((item) => item.categoryId === category.id)?.amount ?? categoryBefore;
    const changePercent = decimal(categoryBefore).isZero()
      ? null
      : percentage(decimal(categoryAfter).minus(categoryBefore).dividedBy(categoryBefore).times(100));

    return {
      analysis,
      period: { start: bounds.start.toISOString(), end: bounds.end.toISOString() },
      before: { summary: beforeSummary, pulse: beforePulse },
      after: { summary: afterSummary, pulse: afterPulse },
      categoryImpact: {
        categoryId: category.id,
        categoryName: category.name,
        before: money(categoryBefore),
        after: money(categoryAfter),
        changePercent,
      },
    };
  }
}
