import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly userId: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.userId = config.getOrThrow<string>('DEMO_USER_ID');
  }

  async list(unreadOnly: boolean): Promise<object> {
    const where = { userId: this.userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.notification.count({ where: { userId: this.userId, readAt: null } }),
    ]);
    return { data: items, unreadCount };
  }

  async markRead(id: string): Promise<object> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId: this.userId } });
    if (!existing) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() } });
  }
}
