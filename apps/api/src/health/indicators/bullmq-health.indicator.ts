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
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('federation-sync') private federationSyncQueue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const queuesEnabled =
        process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
        process.env.QUEUES_DISABLED?.toLowerCase() !== 'true';
      if (!queuesEnabled) {
        return this.getStatus(key, true, { message: 'queues disabled' });
      }

      const [
        notifWaiting,
        notifActive,
        notifCompleted,
        notifFailed,
        fedWaiting,
        fedActive,
        fedCompleted,
        fedFailed,
      ] = await Promise.all([
        this.notificationsQueue.getWaitingCount(),
        this.notificationsQueue.getActiveCount(),
        this.notificationsQueue.getCompletedCount(),
        this.notificationsQueue.getFailedCount(),
        this.federationSyncQueue.getWaitingCount(),
        this.federationSyncQueue.getActiveCount(),
        this.federationSyncQueue.getCompletedCount(),
        this.federationSyncQueue.getFailedCount(),
      ]);

      const isHealthy = true; // Consideramos saludable si podemos obtener las métricas

      return this.getStatus(key, isHealthy, {
        connection: 'connected',
        queues: {
          notifications: {
            waiting: notifWaiting,
            active: notifActive,
            completed: notifCompleted,
            failed: notifFailed,
          },
          federation_sync: {
            waiting: fedWaiting,
            active: fedActive,
            completed: fedCompleted,
            failed: fedFailed,
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
