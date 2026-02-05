import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { BullMQHealthIndicator } from './indicators/bullmq-health.indicator';
import { ExternalApisHealthIndicator } from './indicators/external-apis-health.indicator';
import { WebSocketHealthIndicator } from './indicators/websocket-health.indicator';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TerminusModule, QueuesModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    BullMQHealthIndicator,
    ExternalApisHealthIndicator,
    WebSocketHealthIndicator,
  ],
  exports: [
    RedisHealthIndicator,
    BullMQHealthIndicator,
    ExternalApisHealthIndicator,
    WebSocketHealthIndicator,
  ],
})
export class HealthModule { }
