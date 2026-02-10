import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly client: Redis | null,
  ) {}

  private getClient(): Redis | null {
    const redisEnabled =
      process.env.REDIS_ENABLED?.toLowerCase() !== 'false' &&
      process.env.REDIS_DISABLED?.toLowerCase() !== 'true';
    if (!redisEnabled) {
      return null;
    }
    return this.client;
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
}
