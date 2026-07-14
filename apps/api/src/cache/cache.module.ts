import { Global, Module } from '@nestjs/common';
import { AggregateCacheService } from './aggregate-cache.service';
import { RedisConnection } from './redis.connection';

@Global()
@Module({ providers: [RedisConnection, AggregateCacheService], exports: [AggregateCacheService] })
export class CacheModule {}
