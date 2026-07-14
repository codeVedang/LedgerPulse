import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<object[]> {
    return this.prisma.category.findMany({
      where: { userId: this.config.getOrThrow<string>('DEMO_USER_ID'), isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, type: true, color: true },
    });
  }
}
