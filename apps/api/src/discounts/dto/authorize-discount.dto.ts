import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO para autorizar un descuento
 */
export class AuthorizeDiscountDto {
  @IsUUID()
  sale_id: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  reason?: string | null;

  @IsString()
  @IsOptional()
  authorization_pin?: string; // PIN del supervisor/owner para autorizar
}
