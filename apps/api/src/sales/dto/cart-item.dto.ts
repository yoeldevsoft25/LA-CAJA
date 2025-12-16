import { IsUUID, IsNumber, Min, IsOptional } from 'class-validator';

export class CartItemDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  @IsOptional()
  variant_id?: string | null;

  @IsNumber()
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
}

