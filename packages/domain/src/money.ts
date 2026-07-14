import Decimal from 'decimal.js';

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

export const ZERO = new Decimal(0);

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function money(value: Decimal.Value): string {
  return decimal(value).toDecimalPlaces(2).toFixed(2);
}

export function percentage(value: Decimal.Value): string {
  return decimal(value).toDecimalPlaces(2).toFixed(2);
}

export function sum(values: readonly Decimal.Value[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(value), ZERO);
}

export function median(values: readonly Decimal.Value[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = values.map(decimal).sort((left, right) => left.comparedTo(right));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return sorted[middle - 1]!.plus(sorted[middle]!).dividedBy(2);
}

export function percentile(values: readonly Decimal.Value[], quantile: number): Decimal | null {
  if (values.length === 0) return null;
  if (quantile < 0 || quantile > 1) throw new RangeError('Quantile must be between 0 and 1');
  const sorted = values.map(decimal).sort((left, right) => left.comparedTo(right));
  if (sorted.length === 1) return sorted[0]!;
  const position = new Decimal(sorted.length - 1).times(quantile);
  const lower = position.floor().toNumber();
  const upper = position.ceil().toNumber();
  if (lower === upper) return sorted[lower]!;
  const fraction = position.minus(lower);
  return sorted[lower]!.plus(sorted[upper]!.minus(sorted[lower]!).times(fraction));
}

export function medianAbsoluteDeviation(values: readonly Decimal.Value[]): Decimal | null {
  const centre = median(values);
  if (centre === null) return null;
  return median(values.map((value) => decimal(value).minus(centre).abs()));
}

export function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundContribution(value: number): number {
  return Math.round(value);
}

export function linear(
  value: number,
  from: number,
  to: number,
  scoreFrom: number,
  scoreTo: number,
): number {
  if (to === from) return scoreTo;
  const progress = clampNumber((value - from) / (to - from), 0, 1);
  return scoreFrom + progress * (scoreTo - scoreFrom);
}
