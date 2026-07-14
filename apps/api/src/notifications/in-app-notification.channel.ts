import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { NotificationChannel, NotificationMessage } from './notification-channel';

@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  readonly name = 'in-app';

  constructor(private readonly prisma: PrismaService) {}

  async send(message: NotificationMessage): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: message.userId,
        eventType: message.eventType,
        severity: message.severity,
        title: message.title,
        body: message.body,
        ...(message.transactionId ? { transactionId: message.transactionId } : {}),
      },
    });
  }
}
