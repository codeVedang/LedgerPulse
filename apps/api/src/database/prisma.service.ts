import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly appLogger: PinoLogger) {
    super();
    appLogger.setContext(PrismaService.name);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      this.appLogger.error({ err: error }, 'database_connection_failed');
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
