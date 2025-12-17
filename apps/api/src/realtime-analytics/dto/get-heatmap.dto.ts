import { IsDateString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetHeatmapDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hour?: number; // 0-23, opcional para filtrar por hora específica
}
