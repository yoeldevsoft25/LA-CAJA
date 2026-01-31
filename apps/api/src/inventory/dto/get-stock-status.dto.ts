import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetStockStatusDto {
  @IsUUID()
  @IsOptional()
  product_id?: string;

  @IsUUID()
  @IsOptional()
  warehouse_id?: string;

  @IsString()
  @IsOptional()
  search?: string;

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

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  low_stock_only?: boolean;

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
