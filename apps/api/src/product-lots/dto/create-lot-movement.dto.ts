import {
  IsUUID,
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsDateString,
} from 'class-validator';

export type LotMovementType =
  | 'received'
  | 'sold'
  | 'expired'
  | 'damaged'
  | 'adjusted';

/**
 * DTO para crear un movimiento de lote
 */
export class CreateLotMovementDto {
  @IsUUID()
  lot_id: string;

  @IsString()
  @IsIn(['received', 'sold', 'expired', 'damaged', 'adjusted'])
  movement_type: LotMovementType;

  @IsNumber()
  qty_delta: number; // Positivo para entradas, negativo para salidas

  @IsDateString()
  happened_at: string;

  @IsUUID()
  @IsOptional()
  sale_id?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
