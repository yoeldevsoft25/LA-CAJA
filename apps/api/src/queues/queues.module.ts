import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'notifications',
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'sales-projections',
        defaultJobOptions: {
          attempts: 10, // Projections are CRITICAL
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for inspection (DLQ-like)
        },
      },
      {
        name: 'sales-post-processing',
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule { }
