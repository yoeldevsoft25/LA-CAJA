import { ApiProperty } from '@nestjs/swagger';

export class ServiceHealthDto {
  @ApiProperty({ description: 'Nombre del servicio' })
  name: string;

  @ApiProperty({
    description: 'Estado del servicio',
    enum: ['up', 'down', 'degraded'],
  })
  status: 'up' | 'down' | 'degraded';

  @ApiProperty({ description: 'Tiempo de respuesta en ms', required: false })
  responseTime?: number;

  @ApiProperty({ description: 'Última verificación', required: false })
  lastChecked?: Date;

  @ApiProperty({ description: 'Mensaje de error si existe', required: false })
  error?: string;
}

export class HealthStatusDto {
  @ApiProperty({ description: 'Estado general del sistema' })
  status: 'ok' | 'degraded' | 'down';

  @ApiProperty({ description: 'Uptime actual en porcentaje' })
  uptime: number;

  @ApiProperty({ description: 'Uptime objetivo (99.9%)' })
  targetUptime: number;

  @ApiProperty({
    description: 'Lista de servicios y su estado',
    type: [ServiceHealthDto],
  })
  services: ServiceHealthDto[];

  @ApiProperty({ description: 'Timestamp de la verificación' })
  timestamp: Date;
}
