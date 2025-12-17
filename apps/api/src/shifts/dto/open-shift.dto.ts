import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para abrir un nuevo turno
 */
export class OpenShiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto inicial en Bs no puede ser negativo' })
  opening_amount_bs: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto inicial en USD no puede ser negativo' })
  opening_amount_usd: number;

  @IsString()
  @IsOptional()
  note?: string;
}
