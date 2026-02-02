import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsIn,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para coordenadas de la mesa en el plano
 */
class CoordinatesDto {
  @IsInt()
  x: number;

  @IsInt()
  y: number;

  @IsString()
  @IsOptional()
  @IsIn(['table', 'bar', 'corridor', 'wall', 'zone'])
  type?: 'table' | 'bar' | 'corridor' | 'wall' | 'zone';

  @IsInt()
  @IsOptional()
  @Min(1)
  w?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  h?: number;
}

/**
 * DTO para crear una mesa
 */
export class CreateTableDto {
  @IsString()
  @MaxLength(20, {
    message: 'El número de mesa no puede exceder 20 caracteres',
  })
  table_number: string;

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
  status?:
    | 'available'
    | 'occupied'
    | 'reserved'
    | 'cleaning'
    | 'out_of_service';

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'La zona no puede exceder 50 caracteres' })
  zone?: string | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: { x: number; y: number } | null;

  @IsInt()
  @Min(1, { message: 'El tiempo estimado debe ser mayor a 0' })
  @IsOptional()
  estimated_dining_time?: number | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
