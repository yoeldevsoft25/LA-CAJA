import {
  IsUUID,
  IsNumber,
  Min,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * DTO para crear un item de lista de precio
 */
export class CreatePriceListItemDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  @IsOptional()
  variant_id?: string | null;

  @IsNumber()
  @Min(0)
  price_bs: number;

  @IsNumber()
  @Min(0)
  price_usd: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  min_qty?: number | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
