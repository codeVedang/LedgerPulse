import type { NotificationSeverity } from '@prisma/client';

export interface NotificationMessage {
  userId: string;
  transactionId?: string;
  eventType: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
}

export interface NotificationChannel {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}
