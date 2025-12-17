import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePeripheralConfigDto } from './create-peripheral-config.dto';

/**
 * DTO para actualizar configuración de periférico
 */
export class UpdatePeripheralConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(['serial', 'usb', 'network', 'bluetooth', 'web_serial'])
  connection_type?: 'serial' | 'usb' | 'network' | 'bluetooth' | 'web_serial';

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePeripheralConfigDto)
  connection_config?: CreatePeripheralConfigDto['connection_config'];

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
