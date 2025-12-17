import { IsUUID, IsOptional } from 'class-validator';

/**
 * DTO para mover una orden a otra mesa
 */
export class MoveOrderDto {
  @IsUUID()
  @IsOptional()
  table_id?: string | null; // NULL para orden sin mesa
}
