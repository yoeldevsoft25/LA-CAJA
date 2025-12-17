import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para item de orden
 */
export class OrderItemDto {
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

/**
 * DTO para crear una orden
 */
export class CreateOrderDto {
  @IsUUID()
  @IsOptional()
  table_id?: string | null;

  @IsUUID()
  @IsOptional()
  customer_id?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsOptional()
  items?: OrderItemDto[]; // Items iniciales (opcional)
}
