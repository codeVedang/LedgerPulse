import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { decimal, money } from '@ledgerpulse/domain';
import { AggregateCacheService } from '../cache/aggregate-cache.service';
import { PrismaService } from '../database/prisma.service';
import { DomainEventBus } from '../events/domain-event-bus.service';
import type { DomainEvent } from '../events/domain-events';
import type { CreateTransactionDto, TransactionFiltersDto, UpdateTransactionDto } from './dto/transaction.dto';
import { TransactionSort } from './dto/transaction.dto';
import {
  TransactionEvaluator,
  type NormalizedCandidate,
  type TransactionEvaluation,
} from './transaction-evaluator.service';
import { toTransactionResponse, transactionInclude, type TransactionWithCategory } from './transaction.mapper';

const MAX_AMOUNT = decimal('999999999999.99');
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const IDEMPOTENCY_OPERATION = 'CREATE_TRANSACTION';

interface CreateResult {
  row: TransactionWithCategory;
  replayed: boolean;
  evaluation?: TransactionEvaluation;
}

@Injectable()
export class TransactionsService {
  private readonly userId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: TransactionEvaluator,
    private readonly cache: AggregateCacheService,
    private readonly events: DomainEventBus,
    config: ConfigService,
  ) {
    this.userId = config.getOrThrow<string>('DEMO_USER_ID');
  }

  async preview(dto: CreateTransactionDto): Promise<TransactionEvaluation> {
    const candidate = this.normalize(dto);
    return this.prisma.$transaction(async (tx) => {
      const user = await this.requireUser(tx);
      return this.evaluator.evaluate(tx, user, candidate);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async create(dto: CreateTransactionDto, idempotencyKey: string): Promise<object> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a UUID');
    }
    const candidate = this.normalize(dto);
    const requestHash = this.hash(candidate);
    let result: CreateResult | undefined;
    for (let attempt = 0; attempt < 3 && result === undefined; attempt += 1) {
      try {
        result = await this.createInTransaction(candidate, idempotencyKey, requestHash);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          result = await this.resolveConcurrentReplay(idempotencyKey, requestHash);
          break;
        }
        throw error;
      }
    }
    if (!result) throw new ConflictException('Transaction creation could not be serialized; retry with the same key');

    if (!result.replayed && result.evaluation) {
      await this.cache.invalidateUser(this.userId);
      await this.events.publish(this.eventsFor(result.row, result.evaluation));
    }
    return { data: toTransactionResponse(result.row), idempotency: { replayed: result.replayed } };
  }

  async list(filters: TransactionFiltersDto): Promise<object> {
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      throw new BadRequestException('from must be earlier than to');
    }
    if (filters.minAmount && filters.maxAmount && decimal(filters.minAmount).greaterThan(filters.maxAmount)) {
      throw new BadRequestException('minAmount must not exceed maxAmount');
    }
    const where: Prisma.TransactionWhereInput = {
      userId: this.userId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.from || filters.to
        ? {
            transactionDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
      ...(filters.minAmount || filters.maxAmount
        ? {
            amount: {
              ...(filters.minAmount ? { gte: filters.minAmount } : {}),
              ...(filters.maxAmount ? { lte: filters.maxAmount } : {}),
            },
          }
        : {}),
    };
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      filters.sort === TransactionSort.OLDEST
        ? { transactionDate: 'asc' }
        : filters.sort === TransactionSort.AMOUNT_HIGH
          ? { amount: 'desc' }
          : filters.sort === TransactionSort.AMOUNT_LOW
            ? { amount: 'asc' }
            : { transactionDate: 'desc' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      data: rows.map(toTransactionResponse),
      page: { number: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
    };
  }

  async get(id: string): Promise<object> {
    return { data: toTransactionResponse(await this.requireTransaction(id)) };
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<object> {
    const existing = await this.requireTransaction(id);
    const descriptionWasProvided = Object.prototype.hasOwnProperty.call(dto, 'description');
    const mergedDescription = descriptionWasProvided ? dto.description : existing.description;
    const candidate = this.normalize({
      type: dto.type ?? existing.type,
      amount: dto.amount ?? existing.amount.toFixed(2),
      currency: dto.currency ?? 'INR',
      categoryId: dto.categoryId ?? existing.categoryId,
      ...(mergedDescription ? { description: mergedDescription } : {}),
      transactionDate: dto.transactionDate ?? existing.transactionDate.toISOString(),
    });
    const row = await this.prisma.$transaction(async (tx) => {
      const user = await this.requireUser(tx);
      const evaluation = await this.evaluator.evaluate(tx, user, candidate, id);
      return tx.transaction.update({
        where: { id },
        data: {
          ...candidate,
          description: candidate.description ?? null,
          transactionDate: new Date(candidate.transactionDate),
          anomalyScore: evaluation.analysis.score,
          anomalyConfidence: evaluation.analysis.confidence,
          anomalyVersion: evaluation.analysis.engineVersion,
          anomalyAnalysis: evaluation.analysis as unknown as Prisma.InputJsonValue,
        },
        include: transactionInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.cache.invalidateUser(this.userId);
    return { data: toTransactionResponse(row) };
  }

  async remove(id: string): Promise<void> {
    await this.requireTransaction(id);
    await this.prisma.transaction.delete({ where: { id } });
    await this.cache.invalidateUser(this.userId);
  }

  private async createInTransaction(
    candidate: NormalizedCandidate,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<CreateResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: { userId_key_operation: { userId: this.userId, key: idempotencyKey, operation: IDEMPOTENCY_OPERATION } },
        include: { transaction: { include: transactionInclude } },
      });
      if (existing) return this.replay(existing.requestHash, requestHash, existing.transaction);

      await tx.idempotencyRecord.create({
        data: {
          userId: this.userId,
          key: idempotencyKey,
          operation: IDEMPOTENCY_OPERATION,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const user = await this.requireUser(tx);
      const evaluation = await this.evaluator.evaluate(tx, user, candidate);
      const row = await tx.transaction.create({
        data: {
          ...candidate,
          userId: this.userId,
          transactionDate: new Date(candidate.transactionDate),
          anomalyScore: evaluation.analysis.score,
          anomalyConfidence: evaluation.analysis.confidence,
          anomalyVersion: evaluation.analysis.engineVersion,
          anomalyAnalysis: evaluation.analysis as unknown as Prisma.InputJsonValue,
        },
        include: transactionInclude,
      });
      await tx.idempotencyRecord.update({
        where: { userId_key_operation: { userId: this.userId, key: idempotencyKey, operation: IDEMPOTENCY_OPERATION } },
        data: { status: 'COMPLETED', transactionId: row.id },
      });
      return { row, replayed: false, evaluation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async resolveConcurrentReplay(idempotencyKey: string, requestHash: string): Promise<CreateResult> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { userId_key_operation: { userId: this.userId, key: idempotencyKey, operation: IDEMPOTENCY_OPERATION } },
      include: { transaction: { include: transactionInclude } },
    });
    if (!record) throw new ConflictException('Concurrent transaction creation is still resolving; retry with the same key');
    return this.replay(record.requestHash, requestHash, record.transaction);
  }

  private replay(storedHash: string, requestHash: string, row: TransactionWithCategory | null): CreateResult {
    if (storedHash !== requestHash) throw new ConflictException('Idempotency key was already used with a different payload');
    if (!row) throw new ConflictException('The original idempotent request has not completed');
    return { row, replayed: true };
  }

  private normalize(dto: CreateTransactionDto | NormalizedCandidate): NormalizedCandidate {
    const amount = decimal(dto.amount);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new BadRequestException('amount must be greater than zero');
    if (amount.greaterThan(MAX_AMOUNT)) throw new BadRequestException('amount exceeds the supported maximum');
    if (amount.decimalPlaces() > 2) throw new BadRequestException('amount supports at most two decimal places');
    const date = new Date(dto.transactionDate);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('transactionDate must be a valid date');
    if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      throw new BadRequestException('transactionDate cannot be in the future');
    }
    return {
      type: dto.type,
      amount: money(amount),
      currency: 'INR',
      categoryId: dto.categoryId,
      ...(dto.description ? { description: dto.description.trim() } : {}),
      transactionDate: date.toISOString(),
    };
  }

  private hash(candidate: NormalizedCandidate): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          type: candidate.type,
          amount: candidate.amount,
          currency: candidate.currency,
          categoryId: candidate.categoryId,
          description: candidate.description ?? null,
          transactionDate: candidate.transactionDate,
        }),
      )
      .digest('hex');
  }

  private async requireUser(db: Prisma.TransactionClient) {
    const user = await db.user.findUnique({ where: { id: this.userId } });
    if (!user) throw new NotFoundException('Demo user is not initialized. Run the database seed.');
    return user;
  }

  private async requireTransaction(id: string): Promise<TransactionWithCategory> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId: this.userId },
      include: transactionInclude,
    });
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }

  private eventsFor(row: TransactionWithCategory, evaluation: TransactionEvaluation): DomainEvent[] {
    const base = { userId: this.userId, transactionId: row.id, occurredAt: new Date().toISOString() };
    const events: DomainEvent[] = [
      { ...base, type: 'TRANSACTION_CREATED', categoryName: row.category.name, transactionType: row.type },
    ];
    if (evaluation.analysis.score >= 80 && evaluation.analysis.confidence !== 'LOW') {
      events.push({
        ...base,
        type: 'HIGH_ANOMALY_DETECTED',
        categoryName: row.category.name,
        score: evaluation.analysis.score,
        confidence: evaluation.analysis.confidence,
      });
    }
    const spike = evaluation.analysis.reasons.find((reason) => reason.code === 'CATEGORY_SPENDING_SPIKE');
    if (spike && typeof spike.evidence.ratio === 'string') {
      events.push({ ...base, type: 'CATEGORY_SPIKE_DETECTED', categoryName: row.category.name, ratio: spike.evidence.ratio });
    }
    const savingsRate = evaluation.after.summary.savingsRate;
    if (savingsRate !== null && decimal(savingsRate).lessThan(10)) {
      events.push({ ...base, type: 'LOW_SAVINGS_RATE', savingsRate });
    }
    return events;
  }
}
