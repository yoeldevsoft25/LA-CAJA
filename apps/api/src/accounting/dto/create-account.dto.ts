import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export class CreateAccountDto {
  @IsString()
  account_code: string;

  @IsString()
  account_name: string;

  @IsEnum(AccountType)
  account_type: AccountType;

  @IsOptional()
  @IsUUID()
  parent_account_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  level?: number = 1;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsBoolean()
  allows_entries?: boolean = true;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
