import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum JournalEntryType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  INVOICE = 'invoice',
  FISCAL_INVOICE = 'fiscal_invoice',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  EXPENSE = 'expense',
  INCOME = 'income',
  PAYMENT = 'payment',
  RECEIPT = 'receipt',
  MANUAL = 'manual',
}

export class JournalEntryLineDto {
  @IsUUID()
  account_id: string;

  @IsString()
  account_code: string;

  @IsString()
  account_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  debit_amount_bs: number;

  @IsNumber()
  @Min(0)
  credit_amount_bs: number;

  @IsNumber()
  @Min(0)
  debit_amount_usd: number;

  @IsNumber()
  @Min(0)
  credit_amount_usd: number;

  @IsOptional()
  @IsString()
  cost_center?: string;

  @IsOptional()
  @IsString()
  project_code?: string;

  @IsOptional()
  @IsString()
  tax_code?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateJournalEntryDto {
  @IsDateString()
  entry_date: string;

  @IsEnum(JournalEntryType)
  entry_type: JournalEntryType;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsUUID()
  source_id?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsOptional()
  @IsNumber()
  exchange_rate?: number;

  @IsOptional()
  @IsString()
  currency?: 'BS' | 'USD' | 'MIXED' = 'BS';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines: JournalEntryLineDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
