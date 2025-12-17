import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class PredictDemandDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  @Max(90) // Máximo 90 días hacia adelante
  days_ahead: number = 7;
}
