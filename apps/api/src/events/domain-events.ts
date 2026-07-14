import type { Confidence } from '@ledgerpulse/domain';

interface BaseEvent {
  userId: string;
  transactionId: string;
  occurredAt: string;
}

export type DomainEvent =
  | (BaseEvent & { type: 'TRANSACTION_CREATED'; categoryName: string; transactionType: 'INCOME' | 'EXPENSE' })
  | (BaseEvent & { type: 'HIGH_ANOMALY_DETECTED'; categoryName: string; score: number; confidence: Confidence })
  | (BaseEvent & { type: 'CATEGORY_SPIKE_DETECTED'; categoryName: string; ratio: string })
  | (BaseEvent & { type: 'LOW_SAVINGS_RATE'; savingsRate: string });
