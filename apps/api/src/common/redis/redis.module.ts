import { Global, Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (configService: ConfigService) => {
                const redisEnabled =
                    process.env.REDIS_ENABLED?.toLowerCase() !== 'false' &&
                    process.env.REDIS_DISABLED?.toLowerCase() !== 'true';

                if (!redisEnabled) {
                    return null;
                }

                const redisUrl = configService.get<string>('REDIS_URL');
                const options = {
                    maxRetriesPerRequest: null, // Requerido por BullMQ
                    enableOfflineQueue: true,
                    connectTimeout: 10000,
                    lazyConnect: true, // ⚡ OPTIMIZACIÓN: Solo conectar al usar
                };

                const client = redisUrl
                    ? new Redis(redisUrl, options)
                    : new Redis({
                        host: configService.get<string>('REDIS_HOST') || 'localhost',
                        port: configService.get<number>('REDIS_PORT') || 6379,
                        password: configService.get<string>('REDIS_PASSWORD'),
                        ...options,
                    });

                client.on('error', (err) => {
                    console.error('❌ Redis Client Error:', err.message);
                });

                return client;
            },
            inject: [ConfigService],
        },
        {
            provide: REDIS_SUBSCRIBER,
            useFactory: (client: Redis | null) => {
                if (!client) return null;
                const subscriber = client.duplicate();
                subscriber.on('error', (err) => {
                    console.error('❌ Redis Subscriber Error:', err.message);
                });
                return subscriber;
            },
            inject: [REDIS_CLIENT],
        },
    ],
    exports: [REDIS_CLIENT, REDIS_SUBSCRIBER],
})
export class RedisModule { }
