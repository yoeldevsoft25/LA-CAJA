import { IsEnum, IsDateString, IsOptional } from 'class-validator';
import { MetricType } from './get-metrics.dto';

export enum ComparisonPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class GetComparativeDto {
  @IsEnum(MetricType)
  metric_type: MetricType;

  @IsEnum(ComparisonPeriod)
  period: ComparisonPeriod;

  @IsDateString()
  @IsOptional()
  reference_date?: string; // Si no se proporciona, usa la fecha actual
}
