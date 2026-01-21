import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint ligero para mantener el servicio despierto
   * Útil para servicios de ping externos (UptimeRobot, cron-job.org, etc.)
   * No requiere autenticación y es muy rápido
   * 
   * Nota: El endpoint /health está manejado por HealthController
   */
  @Get('ping')
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Service is alive',
    };
  }

  /**
   * Endpoint alternativo de keepalive
   * Alias para /ping
   */
  @Get('keepalive')
  keepAlive() {
    return this.ping();
  }
}
