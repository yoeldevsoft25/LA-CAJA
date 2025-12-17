import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  IsIn,
  Min,
  ValidateIf,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CartItemDto } from './cart-item.dto';

export class CreateSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsNumber()
  @Min(0)
  exchange_rate: number;

  @IsString()
  @IsIn(['BS', 'USD', 'MIXED'])
  currency: 'BS' | 'USD' | 'MIXED';

  @IsString()
  @IsIn([
    'CASH_BS',
    'CASH_USD',
    'PAGO_MOVIL',
    'TRANSFER',
    'OTHER',
    'SPLIT',
    'FIAO',
  ])
  payment_method: string;

  @IsOptional()
  @ValidateIf((o) => o.payment_method === 'SPLIT')
  split?: {
    cash_bs?: number;
    cash_usd?: number;
    pago_movil_bs?: number;
    transfer_bs?: number;
    other_bs?: number;
  };

  // Para pagos en efectivo USD con cambio en Bs
  @IsOptional()
  @ValidateIf((o) => o.payment_method === 'CASH_USD')
  cash_payment?: {
    received_usd: number; // Monto recibido en USD físico
    change_bs?: number; // Cambio dado en Bs (si aplica)
  };

  // Para pagos en efectivo Bs con cambio en Bs
  @IsOptional()
  @ValidateIf((o) => o.payment_method === 'CASH_BS')
  cash_payment_bs?: {
    received_bs: number; // Monto recibido en Bs físico
    change_bs?: number; // Cambio dado en Bs (redondeado)
  };

  @IsUUID()
  @IsOptional()
  @ValidateIf(
    (o) =>
      o.payment_method === 'FIAO' &&
      !o.customer_document_id &&
      !o.customer_name,
  )
  customer_id?: string;

  // Campos opcionales para crear/actualizar cliente en cualquier venta
  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  customer_document_id?: string;

  @IsString()
  @IsOptional()
  customer_phone?: string;

  @IsString()
  @IsOptional()
  customer_note?: string;

  @IsOptional()
  @IsString()
  cash_session_id?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsUUID()
  @IsOptional()
  invoice_series_id?: string; // Serie de factura a usar (opcional, usa la por defecto si no se especifica)

  @IsUUID()
  @IsOptional()
  price_list_id?: string; // Lista de precio a usar (opcional, usa la por defecto si no se especifica)

  @IsUUID()
  @IsOptional()
  promotion_id?: string; // Promoción a aplicar (opcional)

  @IsUUID()
  @IsOptional()
  warehouse_id?: string; // Bodega de donde se vende (NULL = bodega por defecto)
}
