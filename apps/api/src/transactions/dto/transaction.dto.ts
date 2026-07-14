import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

const amountPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

const trimOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsString()
  @Matches(amountPattern, { message: 'amount must be a positive decimal with at most 2 fractional digits' })
  amount!: string;

  @IsIn(['INR'])
  currency!: 'INR';

  @IsUUID()
  categoryId!: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  transactionDate!: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @Matches(amountPattern, { message: 'amount must be a positive decimal with at most 2 fractional digits' })
  amount?: string;

  @IsOptional()
  @IsIn(['INR'])
  currency?: 'INR';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Transform(trimOptional)
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  transactionDate?: string;
}

export enum TransactionSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  AMOUNT_HIGH = 'amount-high',
  AMOUNT_LOW = 'amount-low',
}

export class TransactionFiltersDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  to?: string;

  @IsOptional()
  @Matches(amountPattern)
  minAmount?: string;

  @IsOptional()
  @Matches(amountPattern)
  maxAmount?: string;

  @IsOptional()
  @IsEnum(TransactionSort)
  sort: TransactionSort = TransactionSort.NEWEST;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PeriodQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  to?: string;
}
