import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MetricType {
  SALES = 'sales',
  INVENTORY = 'inventory',
  REVENUE = 'revenue',
  PROFIT = 'profit',
  CUSTOMERS = 'customers',
  PRODUCTS = 'products',
  DEBT = 'debt',
  PURCHASES = 'purchases',
}

export enum PeriodType {
  CURRENT = 'current',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class GetMetricsDto {
  @IsOptional()
  @IsEnum(MetricType)
  metric_type?: MetricType;

  @IsOptional()
  @IsString()
  metric_name?: string;

  @IsOptional()
  @IsEnum(PeriodType)
  period_type?: PeriodType;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 100;
}
