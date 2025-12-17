import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsIn,
} from 'class-validator';

/**
 * DTO para actualizar una mesa
 */
export class UpdateTableDto {
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'El número de mesa no puede exceder 20 caracteres' })
  table_number?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string | null;

  @IsInt()
  @Min(1, { message: 'La capacidad debe ser mayor a 0' })
  @IsOptional()
  capacity?: number | null;

  @IsString()
  @IsOptional()
  @IsIn(['available', 'occupied', 'reserved', 'cleaning', 'out_of_service'])
  status?: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';

  @IsString()
  @IsOptional()
  note?: string | null;
}

