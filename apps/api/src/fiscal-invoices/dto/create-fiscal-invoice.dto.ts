import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFiscalInvoiceItemDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price_bs: number;

  @IsNumber()
  @Min(0)
  unit_price_usd: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_bs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_usd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;
}

export class CreateFiscalInvoiceDto {
  @IsOptional()
  @IsUUID()
  sale_id?: string;

  @IsOptional()
  @IsUUID()
  invoice_series_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['invoice', 'credit_note', 'debit_note'])
  invoice_type?: 'invoice' | 'credit_note' | 'debit_note';

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_tax_id?: string;

  @IsOptional()
  @IsString()
  customer_address?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFiscalInvoiceItemDto)
  items: CreateFiscalInvoiceItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
