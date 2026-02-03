import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ObservabilityService } from './services/observability.service';
import { AlertService } from './services/alert.service';
import { UptimeTrackerService } from './services/uptime-tracker.service';
import { HealthStatusDto } from './dto/health-status.dto';
import { MetricsDto } from './dto/metrics.dto';
import {
  AlertDto,
  CreateAlertDto,
  UpdateAlertStatusDto,
} from './dto/alert.dto';
import { UptimeStatsDto, UptimeHistoryDto } from './dto/uptime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('observability')
@Controller('observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
@ApiBearerAuth('JWT-auth')
export class ObservabilityController {
  constructor(
    private observabilityService: ObservabilityService,
    private alertService: AlertService,
    private uptimeTracker: UptimeTrackerService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado general del sistema' })
  @ApiResponse({ status: 200, type: HealthStatusDto })
  async getStatus(): Promise<HealthStatusDto> {
    return this.observabilityService.getStatus();
  }

  @Get('services')
  @ApiOperation({ summary: 'Obtener estado de todos los servicios' })
  @ApiResponse({ status: 200, description: 'Lista de servicios y su estado' })
  async getServices() {
    // Implementación simplificada - debería obtener de health checks
    return {
      services: [
        { name: 'database', status: 'up' },
        { name: 'redis', status: 'up' },
        { name: 'queues', status: 'up' },
      ],
    };
  }

  @Get('uptime')
  @ApiOperation({ summary: 'Obtener uptime actual y estadísticas' })
  @ApiResponse({ status: 200, type: UptimeStatsDto })
  async getUptime(
    @Query('service') serviceName?: string,
    @Query('days') days?: number,
  ): Promise<UptimeStatsDto> {
    return this.uptimeTracker.calculateUptime(serviceName, days || 30);
  }

  @Get('uptime/history')
  @ApiOperation({ summary: 'Obtener historial de uptime' })
  @ApiResponse({ status: 200, type: [UptimeHistoryDto] })
  async getUptimeHistory(
    @Query('service') serviceName?: string,
    @Query('hours') hours?: number,
  ) {
    return this.uptimeTracker.getUptimeHistory(serviceName, hours || 24);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Obtener métricas agregadas' })
  @ApiResponse({ status: 200, type: MetricsDto })
  async getMetrics(): Promise<MetricsDto> {
    return this.observabilityService.getMetrics();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Obtener alertas activas' })
  @ApiResponse({ status: 200, type: [AlertDto] })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('service') serviceName?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.alertService.getAlerts(
      status as any,
      severity as any,
      serviceName,
      limit || 100,
      offset || 0,
    );
  }

  @Post('alerts')
  @ApiOperation({ summary: 'Crear una nueva alerta' })
  @ApiResponse({ status: 201, type: AlertDto })
  async createAlert(@Body() dto: CreateAlertDto): Promise<AlertDto> {
    return this.alertService.createAlert(dto);
  }

  @Patch('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolver una alerta' })
  @ApiResponse({ status: 200, type: AlertDto })
  async resolveAlert(@Param('id') id: string): Promise<AlertDto> {
    return this.alertService.resolveAlert(id);
  }

  @Patch('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Reconocer una alerta' })
  @ApiResponse({ status: 200, type: AlertDto })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<AlertDto> {
    return this.alertService.acknowledgeAlert(id, req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Obtener historial de eventos' })
  @ApiResponse({ status: 200, description: 'Historial de eventos' })
  async getHistory() {
    // Implementación futura
    return { events: [] };
  }
}
