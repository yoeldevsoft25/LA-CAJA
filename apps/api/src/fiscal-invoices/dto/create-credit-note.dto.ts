import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para crear una nota de crédito a partir de una factura emitida.
 * El motivo es opcional (ej. "Venta duplicada por error").
 */
export class CreateCreditNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
