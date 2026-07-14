import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DEMO_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Environment = z.infer<typeof schema>;

export function validateEnvironment(values: Record<string, unknown>): Environment {
  const result = schema.safeParse(values);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
