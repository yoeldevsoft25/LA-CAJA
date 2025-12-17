import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  ValidateNested,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para configuración de conexión
 */
class ConnectionConfigDto {
  @IsString()
  @IsOptional()
  serialPort?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  baudRate?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  dataBits?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  stopBits?: number;

  @IsString()
  @IsOptional()
  parity?: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  networkPort?: number;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsObject()
  @IsOptional()
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;

  @IsObject()
  @IsOptional()
  printer?: {
    paperWidth?: number;
    encoding?: string;
  };

  @IsObject()
  @IsOptional()
  scale?: {
    protocol?: string;
    unit?: string;
  };

  @IsObject()
  @IsOptional()
  scanner?: {
    prefix?: string;
    suffix?: string;
    length?: number;
  };
}

/**
 * DTO para crear configuración de periférico
 */
export class CreatePeripheralConfigDto {
  @IsString()
  @IsIn(['scanner', 'printer', 'drawer', 'scale', 'customer_display'])
  peripheral_type:
    | 'scanner'
    | 'printer'
    | 'drawer'
    | 'scale'
    | 'customer_display';

  @IsString()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @IsIn(['serial', 'usb', 'network', 'bluetooth', 'web_serial'])
  connection_type: 'serial' | 'usb' | 'network' | 'bluetooth' | 'web_serial';

  @IsObject()
  @ValidateNested()
  @Type(() => ConnectionConfigDto)
  connection_config: ConnectionConfigDto;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsString()
  @IsOptional()
  note?: string | null;
}
