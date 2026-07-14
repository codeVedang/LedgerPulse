import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RedisConnection implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService, private readonly logger: PinoLogger) {
    logger.setContext(RedisConnection.name);
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_500,
      retryStrategy: () => null,
    });
    this.client.on('error', (error) => {
      this.logger.warn({ err: error.message }, 'redis_connection_error');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn({ err: error }, 'redis_unavailable_startup_fallback_enabled');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') this.client.disconnect();
  }
}
