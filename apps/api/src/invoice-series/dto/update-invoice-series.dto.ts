import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * DTO para actualizar una serie de factura
 */
export class UpdateInvoiceSeriesDto {
  @IsString()
  @IsOptional()
  @MaxLength(10, { message: 'El código de serie no puede exceder 10 caracteres' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'El código de serie solo puede contener letras mayúsculas y números',
  })
  series_code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'El prefijo no puede exceder 20 caracteres' })
  prefix?: string | null;

  @IsInt()
  @Min(1, { message: 'El número inicial debe ser mayor a 0' })
  @IsOptional()
  start_number?: number;

  @IsInt()
  @Min(0, { message: 'El número actual no puede ser negativo' })
  @IsOptional()
  current_number?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  note?: string | null;
}

