import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';

export enum AlertType {
  STOCK_LOW = 'stock_low',
  SALE_ANOMALY = 'sale_anomaly',
  REVENUE_DROP = 'revenue_drop',
  REVENUE_SPIKE = 'revenue_spike',
  INVENTORY_HIGH = 'inventory_high',
  DEBT_OVERDUE = 'debt_overdue',
  PRODUCT_EXPIRING = 'product_expiring',
  CUSTOM = 'custom',
}

export enum ComparisonOperator {
  LESS_THAN = 'less_than',
  GREATER_THAN = 'greater_than',
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class CreateThresholdDto {
  @IsEnum(AlertType)
  alert_type: AlertType;

  @IsString()
  metric_name: string;

  @IsNumber()
  @Min(0)
  threshold_value: number;

  @IsEnum(ComparisonOperator)
  comparison_operator: ComparisonOperator = ComparisonOperator.LESS_THAN;

  @IsEnum(AlertSeverity)
  severity: AlertSeverity = AlertSeverity.MEDIUM;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  notification_channels?: string[] = ['in_app'];
}
