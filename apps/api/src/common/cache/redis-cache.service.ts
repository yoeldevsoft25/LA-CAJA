import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Redis | null {
    if (this.client) return this.client;

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;
    const password = this.configService.get<string>('REDIS_PASSWORD');

    try {
      this.client = redisUrl
        ? new Redis(redisUrl, {
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          })
        : new Redis({
            host,
            port,
            password,
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis cache error: ${err?.message || err}`);
      });

      return this.client;
    } catch (error) {
      this.logger.warn(
        `Redis cache disabled: ${error instanceof Error ? error.message : error}`,
      );
      this.client = null;
      return null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) return null;
    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `Redis get failed for ${key}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    try {
      const payload = JSON.stringify(value);
      await client.set(key, payload, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis set failed for ${key}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis del failed for ${key}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await loader();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  getRawClient(): Redis | null {
    return this.getClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
