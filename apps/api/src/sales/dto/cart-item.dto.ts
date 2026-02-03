import {
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
  IsString,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class CartItemDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  @IsOptional()
  variant_id?: string | null;

  @IsNumber()
  @ValidateIf((o) => o.is_weight_product)
  @Min(0.001)
  @ValidateIf((o) => !o.is_weight_product)
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_bs?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_usd?: number;

  // Campos para productos por peso
  @IsBoolean()
  @IsOptional()
  is_weight_product?: boolean;

  @IsString()
  @IsIn(['kg', 'g', 'lb', 'oz'])
  @IsOptional()
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weight_value?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_weight_bs?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_weight_usd?: number | null;
}
