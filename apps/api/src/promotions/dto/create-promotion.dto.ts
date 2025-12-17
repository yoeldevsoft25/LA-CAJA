import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsArray,
  ValidateNested,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para producto en promoción
 */
class PromotionProductDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  @IsOptional()
  variant_id?: string | null;
}

/**
 * DTO para crear una promoción
 */
export class CreatePromotionDto {
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  code?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsIn(['percentage', 'fixed_amount', 'buy_x_get_y', 'bundle'])
  promotion_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle';

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount_percentage?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount_bs?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount_usd?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_purchase_bs?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_purchase_usd?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_discount_bs?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_discount_usd?: number | null;

  @IsDateString()
  valid_from: string;

  @IsDateString()
  valid_until: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  usage_limit?: number | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  customer_limit?: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionProductDto)
  @IsOptional()
  products?: PromotionProductDto[];

  @IsString()
  @IsOptional()
  note?: string | null;
}
