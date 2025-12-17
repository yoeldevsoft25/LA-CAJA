import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export type VariantType = 'size' | 'color' | 'material' | 'style' | 'other';

/**
 * DTO para crear o actualizar una variante de producto
 */
export class CreateProductVariantDto {
  @IsUUID()
  product_id: string;

  @IsString()
  @MaxLength(50, {
    message: 'El tipo de variante no puede exceder 50 caracteres',
  })
  variant_type: VariantType | string;

  @IsString()
  @MaxLength(100, {
    message: 'El valor de la variante no puede exceder 100 caracteres',
  })
  variant_value: string;

  @IsString()
  @IsOptional()
  sku?: string | null;

  @IsString()
  @IsOptional()
  barcode?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price_bs?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price_usd?: number | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
