import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import {
  LicensePlan,
  BillingPeriod,
  LicensePaymentMethod,
} from '../../database/entities/license-payment.entity';

export class CreatePaymentRequestDto {
  @IsNotEmpty()
  @IsEnum(LicensePlan)
  plan: LicensePlan;

  @IsNotEmpty()
  @IsEnum(BillingPeriod)
  billing_period: BillingPeriod;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount_usd: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount_bs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchange_rate?: number;

  @IsNotEmpty()
  @IsEnum(LicensePaymentMethod)
  payment_method: LicensePaymentMethod;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  payment_reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  bank_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_number?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
