import { IsNumber, Min } from 'class-validator';

/**
 * DTO para actualizar un item de orden
 */
export class UpdateOrderItemDto {
  @IsNumber()
  @Min(1)
  qty: number;
}
