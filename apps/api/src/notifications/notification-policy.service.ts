import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { NotificationSeverity } from '@prisma/client';
import { DomainEventBus } from '../events/domain-event-bus.service';
import type { DomainEvent } from '../events/domain-events';
import { NotificationDispatcher } from './notification-dispatcher.service';
import type { NotificationMessage } from './notification-channel';

@Injectable()
export class NotificationPolicy implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly bus: DomainEventBus,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.bus.subscribe((event) => this.handle(event));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: DomainEvent): Promise<void> {
    const base = { userId: event.userId, transactionId: event.transactionId, eventType: event.type };
    let message: NotificationMessage;
    switch (event.type) {
      case 'TRANSACTION_CREATED':
        message = {
          ...base,
          severity: NotificationSeverity.INFO,
          title: 'Transaction recorded',
          body: `${event.categoryName} ${event.transactionType.toLowerCase()} was added to your ledger.`,
        };
        break;
      case 'HIGH_ANOMALY_DETECTED':
        message = {
          ...base,
          severity: NotificationSeverity.CRITICAL,
          title: 'Behaviour change detected',
          body: `${event.categoryName} scored ${event.score}/100 with ${event.confidence.toLowerCase()} confidence. Review the deterministic reasons.`,
        };
        break;
      case 'CATEGORY_SPIKE_DETECTED':
        message = {
          ...base,
          severity: NotificationSeverity.WARNING,
          title: `${event.categoryName} spending accelerated`,
          body: `The current 7-day total is ${event.ratio}× the recent weekly baseline.`,
        };
        break;
      case 'LOW_SAVINGS_RATE':
        message = {
          ...base,
          severity: NotificationSeverity.WARNING,
          title: 'Savings rate needs attention',
          body: `Current-period savings rate is ${event.savingsRate}%.`,
        };
        break;
    }
    await this.dispatcher.dispatch(message);
  }
}
