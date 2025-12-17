import { IsUUID, IsOptional } from 'class-validator';

export class StockStatusDto {
  @IsUUID()
  @IsOptional()
  product_id?: string; // Si no se especifica, devuelve todos los productos de la tienda
}
