import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkPriceChangeItemDto {
  @IsString()
  product_id: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_bs?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_usd?: number;
}

export class BulkPriceChangeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPriceChangeItemDto)
  @IsOptional()
  items?: BulkPriceChangeItemDto[];

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  percentage_change?: number;

  @IsString()
  @IsIn(['none', '0.1', '0.5', '1'])
  @IsOptional()
  rounding?: 'none' | '0.1' | '0.5' | '1';
}
