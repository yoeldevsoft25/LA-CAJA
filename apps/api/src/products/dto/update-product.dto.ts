import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MinLength,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isNaN(num) ? NaN : num;
};

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  low_stock_threshold?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_weight_product?: boolean;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsIn(['kg', 'g', 'lb', 'oz'])
  @IsOptional()
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_weight_bs?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_weight_usd?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_per_weight_bs?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_per_weight_usd?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_weight?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  max_weight?: number | null;

  @IsString()
  @IsOptional()
  scale_plu?: string | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  scale_department?: number | null;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_bs?: number;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_bs?: number;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  price_usd?: number;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost_usd?: number;
}
