import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculatePulse, calculateSummary } from '@ledgerpulse/domain';
import { AggregateCacheService } from '../cache/aggregate-cache.service';
import { assertValidPeriod, monthBounds, type PeriodBounds } from '../common/period';
import { PrismaService } from '../database/prisma.service';
import type { PeriodQueryDto } from '../transactions/dto/transaction.dto';
import { toObservation, toTransactionResponse, transactionInclude } from '../transactions/transaction.mapper';

@Injectable()
export class LedgerService {
  private readonly userId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AggregateCacheService,
    config: ConfigService,
  ) {
    this.userId = config.getOrThrow<string>('DEMO_USER_ID');
  }

  async summary(query: PeriodQueryDto): Promise<object> {
    const context = await this.periodContext(query);
    const key = `ledger:summary:v1:${this.userId}:${context.bounds.start.toISOString()}:${context.bounds.end.toISOString()}`;
    return this.cache.readThrough(key, async () => {
      const rows = await this.periodRows(context.bounds);
      return {
        period: this.serializePeriod(context.bounds, context.timezone),
        summary: calculateSummary(rows.map(toObservation)),
      };
    });
  }

  async pulse(query: PeriodQueryDto): Promise<object> {
    const context = await this.periodContext(query);
    const key = `ledger:pulse:v1:${this.userId}:${context.bounds.start.toISOString()}:${context.bounds.end.toISOString()}`;
    return this.cache.readThrough(key, async () => {
      const [currentRows, allRows] = await Promise.all([
        this.periodRows(context.bounds),
        this.prisma.transaction.findMany({
          where: { userId: this.userId },
          include: transactionInclude,
          orderBy: { transactionDate: 'asc' },
        }),
      ]);
      const current = currentRows.map(toObservation);
      const all = allRows.map(toObservation);
      const summary = calculateSummary(current);
      const now = new Date();
      const asOf = context.bounds.end < now ? new Date(context.bounds.end.getTime() - 1) : now;
      return {
        period: this.serializePeriod(context.bounds, context.timezone),
        summary,
        pulse: calculatePulse({
          currentTransactions: current,
          allTransactions: all,
          summary,
          asOf: asOf.toISOString(),
          timezone: context.timezone,
        }),
      };
    });
  }

  async timeline(query: PeriodQueryDto): Promise<object> {
    const context = await this.periodContext(query);
    const rows = await this.periodRows(context.bounds);
    return {
      period: this.serializePeriod(context.bounds, context.timezone),
      data: rows.map((row) => {
        const response = toTransactionResponse(row) as Record<string, unknown>;
        const analysis = row.anomalyAnalysis as { reasons?: Array<{ text?: string }> } | null;
        return { ...response, primaryReason: analysis?.reasons?.[0]?.text ?? null };
      }),
    };
  }

  private async periodContext(query: PeriodQueryDto): Promise<{ bounds: PeriodBounds; timezone: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: this.userId } });
    if (!user) throw new NotFoundException('Demo user is not initialized. Run the database seed.');
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new BadRequestException('from and to must be provided together');
    }
    const bounds = query.from && query.to
      ? { start: new Date(query.from), end: new Date(query.to) }
      : monthBounds(new Date(), user.timezone);
    try {
      assertValidPeriod(bounds.start, bounds.end);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid period');
    }
    return { bounds, timezone: user.timezone };
  }

  private periodRows(bounds: PeriodBounds) {
    return this.prisma.transaction.findMany({
      where: { userId: this.userId, transactionDate: { gte: bounds.start, lt: bounds.end } },
      include: transactionInclude,
      orderBy: { transactionDate: 'asc' },
    });
  }

  private serializePeriod(bounds: PeriodBounds, timezone: string): object {
    return { start: bounds.start.toISOString(), end: bounds.end.toISOString(), timezone };
  }
}
