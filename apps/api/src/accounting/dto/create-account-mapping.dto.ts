import {
  IsString,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsObject,
} from 'class-validator';

export enum TransactionType {
  SALE_REVENUE = 'sale_revenue',
  SALE_COST = 'sale_cost',
  SALE_TAX = 'sale_tax',
  PURCHASE_EXPENSE = 'purchase_expense',
  PURCHASE_TAX = 'purchase_tax',
  INVENTORY_ASSET = 'inventory_asset',
  CASH_ASSET = 'cash_asset',
  ACCOUNTS_RECEIVABLE = 'accounts_receivable',
  ACCOUNTS_PAYABLE = 'accounts_payable',
  EXPENSE = 'expense',
  INCOME = 'income',
  FX_GAIN_REALIZED = 'fx_gain_realized',
  FX_LOSS_REALIZED = 'fx_loss_realized',
  FX_GAIN_UNREALIZED = 'fx_gain_unrealized',
  FX_LOSS_UNREALIZED = 'fx_loss_unrealized',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

export class CreateAccountMappingDto {
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @IsUUID()
  account_id: string;

  @IsString()
  account_code: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean = false;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
