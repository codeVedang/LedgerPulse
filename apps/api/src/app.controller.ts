import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health(): Promise<object> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'reachable', cache: 'optional' };
  }
}
