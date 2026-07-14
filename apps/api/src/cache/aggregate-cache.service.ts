import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisConnection } from './redis.connection';

@Injectable()
export class AggregateCacheService {
  private circuitOpenUntil = 0;

  constructor(
    private readonly redis: RedisConnection,
    private readonly logger: PinoLogger,
  ) {
    logger.setContext(AggregateCacheService.name);
  }

  async readThrough<T>(key: string, compute: () => Promise<T>, ttlSeconds = 60): Promise<T> {
    if (Date.now() >= this.circuitOpenUntil) {
      try {
        const cached = await this.redis.client.get(key);
        if (cached !== null) {
          this.logger.debug({ cacheKey: key }, 'aggregate_cache_hit');
          return JSON.parse(cached) as T;
        }
        this.logger.debug({ cacheKey: key }, 'aggregate_cache_miss');
      } catch (error) {
        this.fail('read', key, error);
      }
    }

    const value = await compute();
    if (Date.now() >= this.circuitOpenUntil) {
      try {
        const userId = this.userIdFromKey(key);
        const registry = `ledger:aggregate-keys:v1:${userId}`;
        await this.redis.client
          .multi()
          .set(key, JSON.stringify(value), 'EX', ttlSeconds)
          .sadd(registry, key)
          .expire(registry, ttlSeconds * 2)
          .exec();
      } catch (error) {
        this.fail('write', key, error);
      }
    }
    return value;
  }

  async invalidateUser(userId: string): Promise<void> {
    const registry = `ledger:aggregate-keys:v1:${userId}`;
    if (Date.now() < this.circuitOpenUntil) return;
    try {
      const keys = await this.redis.client.smembers(registry);
      if (keys.length > 0) await this.redis.client.del(...keys);
      await this.redis.client.del(registry);
      this.logger.debug({ aggregateKeyCount: keys.length, userId }, 'aggregate_cache_invalidated');
    } catch (error) {
      this.fail('invalidate', registry, error);
    }
  }

  private fail(operation: string, key: string, error: unknown): void {
    this.circuitOpenUntil = Date.now() + 5_000;
    this.logger.warn(
      { operation, cacheKey: key, err: error instanceof Error ? error.message : 'Unknown Redis error' },
      'redis_fallback_to_postgres',
    );
  }

  private userIdFromKey(key: string): string {
    const parts = key.split(':');
    return parts[3] ?? 'unknown';
  }
}
