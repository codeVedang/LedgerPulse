import { Controller, Get, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('unreadOnly', new ParseBoolPipe({ optional: true })) unreadOnly = false): Promise<object> {
    return this.notifications.list(unreadOnly);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string): Promise<object> {
    return this.notifications.markRead(id);
  }
}
