import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear o actualizar producto rápido
 */
export class CreateQuickProductDto {
  @IsUUID()
  product_id: string;

  @IsString()
  @MaxLength(10, { message: 'La tecla rápida no puede exceder 10 caracteres' })
  quick_key: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  position?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
