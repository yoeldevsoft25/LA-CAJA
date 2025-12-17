import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear una lista de precio
 */
export class CreatePriceListDto {
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  code: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsDateString()
  @IsOptional()
  valid_from?: string | null;

  @IsDateString()
  @IsOptional()
  valid_until?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
