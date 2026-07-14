import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { DomainEvent } from './domain-events';

type DomainEventHandler = (event: DomainEvent) => Promise<void>;

@Injectable()
export class DomainEventBus {
  private readonly handlers = new Set<DomainEventHandler>();

  constructor(private readonly logger: PinoLogger) {
    logger.setContext(DomainEventBus.name);
  }

  subscribe(handler: DomainEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === 'HIGH_ANOMALY_DETECTED') {
        this.logger.warn(
          { eventType: event.type, transactionId: event.transactionId, score: event.score, confidence: event.confidence },
          'high_anomaly_domain_event',
        );
      }
      for (const handler of this.handlers) {
        try {
          await handler(event);
        } catch (error) {
          this.logger.error(
            { err: error, eventType: event.type, transactionId: event.transactionId },
            'domain_event_handler_failed',
          );
        }
      }
    }
  }
}
