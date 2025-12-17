import {
  IsOptional,
  IsIn,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  AnomalyType,
  AnomalySeverity,
  EntityType,
} from '../../database/entities/detected-anomaly.entity';

export class DetectAnomaliesDto {
  @IsIn([
    'sale_amount',
    'sale_frequency',
    'product_movement',
    'inventory_level',
    'price_deviation',
    'customer_behavior',
    'payment_pattern',
  ])
  @IsOptional()
  anomaly_type?: AnomalyType;

  @IsIn(['sale', 'product', 'customer', 'inventory', 'payment'])
  @IsOptional()
  entity_type?: EntityType;

  @IsIn(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  min_severity?: AnomalySeverity;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
