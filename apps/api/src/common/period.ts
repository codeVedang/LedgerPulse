import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface PeriodBounds {
  start: Date;
  end: Date;
}

export function monthBounds(instant: Date, timezone: string): PeriodBounds {
  const local = toZonedTime(instant, timezone);
  const startLocal = new Date(local.getFullYear(), local.getMonth(), 1, 0, 0, 0, 0);
  const endLocal = new Date(local.getFullYear(), local.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: fromZonedTime(startLocal, timezone), end: fromZonedTime(endLocal, timezone) };
}

export function assertValidPeriod(start: Date, end: Date): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Invalid period date');
  if (start >= end) throw new Error('Period start must be earlier than period end');
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error('Period cannot exceed 366 days');
  }
}
