import { ApiProperty } from '@nestjs/swagger';

export class MetricValueDto {
  @ApiProperty({ description: 'Nombre de la métrica' })
  name: string;

  @ApiProperty({ description: 'Valor de la métrica' })
  value: number;

  @ApiProperty({ description: 'Etiquetas de la métrica', required: false })
  labels?: Record<string, string>;
}

export class MetricsDto {
  @ApiProperty({ description: 'Métricas HTTP', type: [MetricValueDto] })
  http: MetricValueDto[];

  @ApiProperty({
    description: 'Métricas de base de datos',
    type: [MetricValueDto],
  })
  database: MetricValueDto[];

  @ApiProperty({ description: 'Métricas de colas', type: [MetricValueDto] })
  queues: MetricValueDto[];

  @ApiProperty({ description: 'Métricas de negocio', type: [MetricValueDto] })
  business: MetricValueDto[];

  @ApiProperty({ description: 'Métricas del sistema', type: [MetricValueDto] })
  system: MetricValueDto[];
}
