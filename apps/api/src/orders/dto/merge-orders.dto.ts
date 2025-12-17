import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

/**
 * DTO para fusionar múltiples órdenes
 */
export class MergeOrdersDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'Debe proporcionar al menos 2 órdenes para fusionar' })
  @IsUUID(undefined, { each: true })
  order_ids: string[];

  @IsUUID()
  target_order_id: string; // Orden destino (la que se mantiene)
}

