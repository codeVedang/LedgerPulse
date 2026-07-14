import type { ApiErrorResponse } from '@ledgerpulse/contracts';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const DEMO_TIMEZONE = 'Asia/Kolkata';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    let payload: ApiErrorResponse | null = null;
    try {
      payload = (await response.json()) as ApiErrorResponse;
    } catch {
      // A proxy can fail before the API returns its normal envelope.
    }
    throw new ApiClientError(
      payload?.error.message ?? 'LedgerPulse could not complete the request.',
      payload?.error.code ?? 'NETWORK_ERROR',
      payload?.error.requestId ?? response.headers.get('x-request-id') ?? 'unavailable',
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatMoney(value: string, sign = false): string {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = '00'] = unsigned.split('.');
  const lastThree = integer.slice(-3);
  const leading = integer.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = leading ? `${groupedLeading},${lastThree}` : lastThree;
  const prefix = negative ? '−' : sign && value !== '0.00' ? '+' : '';
  return `${prefix}₹${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

export function formatDate(value: string, includeTime = true): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: DEMO_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export function demoLocalDateTime(instant = new Date()): string {
  return formatInTimeZone(instant, DEMO_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function demoLocalToIso(localDateTime: string): string {
  return fromZonedTime(localDateTime, DEMO_TIMEZONE).toISOString();
}

export function errorDescription(error: unknown): { message: string; requestId?: string } {
  if (error instanceof ApiClientError) return { message: error.message, requestId: error.requestId };
  if (error instanceof Error) return { message: error.message };
  return { message: 'Something unexpected happened.' };
}
