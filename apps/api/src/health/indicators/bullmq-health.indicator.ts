import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  constructor(@InjectQueue('notifications') private notificationsQueue: Queue) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.notificationsQueue.getWaitingCount(),
        this.notificationsQueue.getActiveCount(),
        this.notificationsQueue.getCompletedCount(),
        this.notificationsQueue.getFailedCount(),
      ]);

      const isHealthy = true; // Consideramos saludable si podemos obtener las métricas

      return this.getStatus(key, isHealthy, {
        connection: 'connected',
        queues: {
          notifications: {
            waiting,
            active,
            completed,
            failed,
          },
        },
      });
    } catch (error) {
      throw new HealthCheckError(
        'BullMQ health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
