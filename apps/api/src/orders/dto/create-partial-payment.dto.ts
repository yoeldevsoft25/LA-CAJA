import {
  IsNumber,
  Min,
  IsString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * DTO para crear un pago parcial (recibo parcial)
 */
export class CreatePartialPaymentDto {
  @IsNumber()
  @Min(0)
  amount_bs: number;

  @IsNumber()
  @Min(0)
  amount_usd: number;

  @IsString()
  @IsIn([
    'CASH_BS',
    'CASH_USD',
    'PAGO_MOVIL',
    'TRANSFER',
    'POINT_OF_SALE',
    'ZELLE',
    'OTHER',
    'SPLIT',
    'FIAO',
  ])
  payment_method: string;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsUUID()
  @IsOptional()
  customer_id?: string; // Cliente para la venta parcial
}
