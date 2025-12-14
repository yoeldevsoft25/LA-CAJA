import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @Min(0)
  price_bs: number;

  @IsNumber()
  @Min(0)
  price_usd: number;

  @IsNumber()
  @Min(0)
  cost_bs: number;

  @IsNumber()
  @Min(0)
  cost_usd: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  low_stock_threshold?: number;
}

