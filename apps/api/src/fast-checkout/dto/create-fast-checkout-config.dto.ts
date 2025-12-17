import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export type PaymentMethod =
  | 'CASH_BS'
  | 'CASH_USD'
  | 'PAGO_MOVIL'
  | 'TRANSFER'
  | 'OTHER';

/**
 * DTO para crear o actualizar configuración de caja rápida
 */
export class CreateFastCheckoutConfigDto {
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  max_items?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  allow_discounts?: boolean;

  @IsBoolean()
  @IsOptional()
  allow_customer_selection?: boolean;

  @IsString()
  @IsIn(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER'])
  @IsOptional()
  default_payment_method?: PaymentMethod | null;
}
