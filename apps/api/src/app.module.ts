import { randomUUID } from 'node:crypto';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { CacheModule } from './cache/cache.module';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/exception.filter';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { LedgerModule } from './ledger/ledger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          genReqId: (request, response) => {
            const supplied = request.headers['x-request-id'];
            const safe = typeof supplied === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(supplied);
            const id = safe ? supplied : randomUUID();
            response.setHeader('X-Request-Id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'res.headers["set-cookie"]'],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (request: { id?: string; method?: string; url?: string }) => ({
              id: request.id,
              method: request.method,
              url: request.url,
            }),
            res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
          },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    CacheModule,
    EventsModule,
    CategoriesModule,
    TransactionsModule,
    LedgerModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
