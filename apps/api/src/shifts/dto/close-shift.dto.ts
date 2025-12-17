import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO para cerrar un turno con arqueo
 */
export class CloseShiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto contado en Bs no puede ser negativo' })
  @Max(999999999.99, {
    message: 'El monto en Bs excede el límite máximo permitido',
  })
  counted_bs: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto contado en USD no puede ser negativo' })
  @Max(999999999.99, {
    message: 'El monto en USD excede el límite máximo permitido',
  })
  counted_usd: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  counted_pago_movil_bs?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  counted_transfer_bs?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  counted_other_bs?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
