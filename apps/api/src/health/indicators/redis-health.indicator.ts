import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    private configService: ConfigService,
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {
    super();
  }

  private getRedisClient(): Redis | null {
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
}
