import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleNotificationChannel } from './console-notification.channel';
import { InAppNotificationChannel } from './in-app-notification.channel';
import type { NotificationChannel, NotificationMessage } from './notification-channel';

@Injectable()
export class NotificationDispatcher {
  private readonly channels: NotificationChannel[];

  constructor(
    inApp: InAppNotificationChannel,
    consoleChannel: ConsoleNotificationChannel,
    config: ConfigService,
  ) {
    this.channels = config.get<string>('NODE_ENV') === 'production' ? [inApp] : [inApp, consoleChannel];
  }

  async dispatch(message: NotificationMessage): Promise<void> {
    await Promise.all(this.channels.map((channel) => channel.send(message)));
  }
}
