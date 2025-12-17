import { IsUUID, IsArray, IsString, ArrayMinSize } from 'class-validator';

/**
 * DTO para asignar seriales a una venta
 */
export class AssignSerialsDto {
  @IsUUID()
  sale_id: string;

  @IsUUID()
  sale_item_id: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe proporcionar al menos un número de serie' })
  @IsString({ each: true })
  serial_numbers: string[];
}
