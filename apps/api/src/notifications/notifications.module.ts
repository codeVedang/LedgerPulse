import { Module } from '@nestjs/common';
import { ConsoleNotificationChannel } from './console-notification.channel';
import { InAppNotificationChannel } from './in-app-notification.channel';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationPolicy } from './notification-policy.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    InAppNotificationChannel,
    ConsoleNotificationChannel,
    NotificationDispatcher,
    NotificationPolicy,
    NotificationsService,
  ],
})
export class NotificationsModule {}
