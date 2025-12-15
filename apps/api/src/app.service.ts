import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'la-caja-api',
      version: '1.0.0',
      database: {
        status: 'unknown',
        connected: false,
        error: null as string | null,
      },
    };

    // Verificar conexión a la base de datos
    try {
      if (this.dataSource.isInitialized) {
        // Hacer una query simple para verificar la conexión
        await this.dataSource.query('SELECT 1');
        health.database.status = 'connected';
        health.database.connected = true;
      } else {
        health.database.status = 'not_initialized';
        health.status = 'degraded';
      }
    } catch (error) {
      this.logger.error('Error verificando conexión a la base de datos', error);
      health.database.status = 'error';
      health.database.connected = false;
      health.status = 'degraded';
      health.database.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return health;
  }
}

