import { IsUUID, IsNumber, Min, IsString, IsOptional } from 'class-validator';

/**
 * DTO para agregar un item a una orden
 */
export class AddOrderItemDto {
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

  @IsString()
  @IsOptional()
  note?: string | null; // Nota especial del item
}
