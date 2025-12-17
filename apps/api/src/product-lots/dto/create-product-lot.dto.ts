import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear un lote de producto
 */
export class CreateProductLotDto {
  @IsUUID()
  product_id: string;

  @IsString()
  @MaxLength(100, {
    message: 'El número de lote no puede exceder 100 caracteres',
  })
  lot_number: string;

  @IsNumber()
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  initial_quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unit_cost_bs: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unit_cost_usd: number;

  @IsDateString()
  @IsOptional()
  expiration_date?: string | null;

  @IsDateString()
  received_at: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'El proveedor no puede exceder 500 caracteres' })
  supplier?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
