interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function localParts(instant: string | Date, timezone: string): LocalParts {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const read = (name: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === name)?.value;
    if (value === undefined) throw new Error(`Unable to read local ${name}`);
    return Number(value);
  };
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') };
}

export function localDateKey(instant: string | Date, timezone: string): string {
  const part = localParts(instant, timezone);
  return `${String(part.year).padStart(4, '0')}-${String(part.month).padStart(2, '0')}-${String(part.day).padStart(2, '0')}`;
}

export function localDayOrdinal(instant: string | Date, timezone: string): number {
  const part = localParts(instant, timezone);
  return Math.floor(Date.UTC(part.year, part.month - 1, part.day) / 86_400_000);
}

export function circularHourDistance(left: number, right: number): number {
  const direct = Math.abs(left - right);
  return Math.min(direct, 24 - direct);
}
