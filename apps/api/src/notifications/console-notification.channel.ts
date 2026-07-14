import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { NotificationChannel, NotificationMessage } from './notification-channel';

@Injectable()
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly name = 'console';

  constructor(private readonly logger: PinoLogger) {
    logger.setContext(ConsoleNotificationChannel.name);
  }

  async send(message: NotificationMessage): Promise<void> {
    this.logger.info(
      { channel: this.name, eventType: message.eventType, severity: message.severity, transactionId: message.transactionId },
      'notification_dispatched',
    );
  }
}
