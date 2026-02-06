import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator
  extends HealthIndicator
  implements OnModuleDestroy
{
  private redisClient: Redis | null = null;

  constructor(private configService: ConfigService) {
    super();
    // ⚡ OPTIMIZACIÓN: Lazy initialization - solo crear conexión cuando se necesite
    // Esto evita crear conexiones Redis innecesarias que consumen el límite de clientes
  }

  private getRedisClient(): Redis | null {
    // ⚡ OPTIMIZACIÓN: Crear conexión solo cuando se necesite (lazy)
    if (!this.redisClient) {
      try {
        const redisUrl = this.configService.get<string>('REDIS_URL');

        if (redisUrl) {
          this.redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            connectTimeout: 5000,
            lazyConnect: true, // Conectar solo cuando se necesite
          });
        } else {
          const host =
            this.configService.get<string>('REDIS_HOST') || 'localhost';
          const port = this.configService.get<number>('REDIS_PORT') || 6379;
          const password = this.configService.get<string>('REDIS_PASSWORD');

          this.redisClient = new Redis({
            host,
            port,
            password,
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            connectTimeout: 5000,
            lazyConnect: true, // Conectar solo cuando se necesite
          });
        }

        this.redisClient.on('error', (err) => {
          // Error manejado en isHealthy
        });
      } catch (error) {
        // Error manejado en isHealthy
        return null;
      }
    }
    return this.redisClient;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redisEnabled =
      process.env.REDIS_ENABLED?.toLowerCase() !== 'false' &&
      process.env.REDIS_DISABLED?.toLowerCase() !== 'true';
    if (!redisEnabled) {
      return this.getStatus(key, true, { message: 'redis disabled' });
    }

    const client = this.getRedisClient();

    if (!client) {
      throw new HealthCheckError(
        'Redis no está configurado',
        this.getStatus(key, false, { message: 'Redis no configurado' }),
      );
    }

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        client.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000),
        ),
      ]);
      const responseTime = Date.now() - startTime;

      if (result === 'PONG') {
        const info = await client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        const usedMemory = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

        return this.getStatus(key, true, {
          connection: 'connected',
          responseTime: `${responseTime}ms`,
          usedMemory: `${(usedMemory / 1024 / 1024).toFixed(2)}MB`,
        });
      }

      throw new Error('Redis ping failed');
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  // ⚡ OPTIMIZACIÓN: Cerrar conexión cuando el módulo se destruye
  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }
}
