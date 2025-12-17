import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear un serial de producto
 */
export class CreateProductSerialDto {
  @IsUUID()
  product_id: string;

  @IsString()
  @MaxLength(200, {
    message: 'El número de serie no puede exceder 200 caracteres',
  })
  serial_number: string;

  @IsDateString()
  received_at: string;

  @IsString()
  @IsOptional()
  note?: string | null;
}
