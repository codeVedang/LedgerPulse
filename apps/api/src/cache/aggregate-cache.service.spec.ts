import type Redis from 'ioredis';
import type { PinoLogger } from 'nestjs-pino';
import { AggregateCacheService } from './aggregate-cache.service';
import type { RedisConnection } from './redis.connection';

function loggerMock(): PinoLogger {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  } as unknown as PinoLogger;
}

function cacheWith(client: Partial<Redis>): { cache: AggregateCacheService; logger: PinoLogger } {
  const logger = loggerMock();
  const connection = { client } as unknown as RedisConnection;
  return { cache: new AggregateCacheService(connection, logger), logger };
}

describe('AggregateCacheService', () => {
  it('returns a cache hit without calculating PostgreSQL aggregates', async () => {
    const client = { get: jest.fn().mockResolvedValue('{"score":72}') };
    const { cache } = cacheWith(client);
    const compute = jest.fn().mockResolvedValue({ score: 10 });

    await expect(cache.readThrough('ledger:pulse:v1:user:period', compute)).resolves.toEqual({ score: 72 });
    expect(compute).not.toHaveBeenCalled();
  });

  it('calculates and registers a cache miss', async () => {
    const pipeline = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const client = { get: jest.fn().mockResolvedValue(null), multi: jest.fn().mockReturnValue(pipeline) };
    const { cache } = cacheWith(client);

    await expect(cache.readThrough('ledger:summary:v1:user:period', async () => ({ expenses: '10.00' })))
      .resolves.toEqual({ expenses: '10.00' });
    expect(pipeline.set).toHaveBeenCalledWith(
      'ledger:summary:v1:user:period',
      '{"expenses":"10.00"}',
      'EX',
      60,
    );
    expect(pipeline.sadd).toHaveBeenCalledWith('ledger:aggregate-keys:v1:user', 'ledger:summary:v1:user:period');
  });

  it('falls back to calculation when Redis fails', async () => {
    const client = { get: jest.fn().mockRejectedValue(new Error('Redis unavailable')) };
    const { cache, logger } = cacheWith(client);
    const compute = jest.fn().mockResolvedValue({ expenses: '25.00' });

    await expect(cache.readThrough('ledger:summary:v1:user:period', compute)).resolves.toEqual({ expenses: '25.00' });
    expect(compute).toHaveBeenCalledTimes(1);
    const warn = logger.warn as jest.Mock;
    expect(warn.mock.calls[0]).toEqual([
      expect.objectContaining({ operation: 'read', err: 'Redis unavailable' }),
      'redis_fallback_to_postgres',
    ]);
  });

  it('invalidates registered aggregate keys without scanning Redis', async () => {
    const client = {
      smembers: jest.fn().mockResolvedValue(['ledger:summary:v1:user:p', 'ledger:pulse:v1:user:p']),
      del: jest.fn().mockResolvedValue(2),
    };
    const { cache } = cacheWith(client);

    await cache.invalidateUser('user');
    expect(client.del.mock.calls).toEqual([
      ['ledger:summary:v1:user:p', 'ledger:pulse:v1:user:p'],
      ['ledger:aggregate-keys:v1:user'],
    ]);
  });
});
