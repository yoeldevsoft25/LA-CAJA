import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchProductsDto {
  @IsUUID()
  @IsOptional()
  store_id?: string;

  @IsString()
  @IsOptional()
  search?: string; // Búsqueda por nombre, SKU o barcode

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  is_visible_public?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['sale_item', 'ingredient', 'prepared'])
  product_type?: 'sale_item' | 'ingredient' | 'prepared';

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}
