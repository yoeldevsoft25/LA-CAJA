import { Module, Global } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { createNoopQueue } from './noop-queue';

const QUEUE_NAMES = [
  'notifications',
  'sales-projections',
  'sales-post-processing',
  'federation-sync',
];

const QUEUES_ENABLED =
  process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
  process.env.QUEUES_DISABLED?.toLowerCase() !== 'true';

const REGISTERED_QUEUES_MODULE = QUEUES_ENABLED
  ? BullModule.registerQueue(
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
      {
        name: 'federation-sync',
        defaultJobOptions: {
          attempts: 10,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    )
  : null;

@Global()
@Module({
  imports: [...(REGISTERED_QUEUES_MODULE ? [REGISTERED_QUEUES_MODULE] : [])],
  providers: [
    {
      provide: 'QUEUES_ENABLED',
      useValue: QUEUES_ENABLED,
    },
    ...(!QUEUES_ENABLED
      ? QUEUE_NAMES.map((name) => ({
          provide: getQueueToken(name),
          useValue: createNoopQueue(name),
        }))
      : []),
  ],
  exports: [
    ...(REGISTERED_QUEUES_MODULE ? [REGISTERED_QUEUES_MODULE] : []),
    'QUEUES_ENABLED',
    ...(!QUEUES_ENABLED ? QUEUE_NAMES.map((name) => getQueueToken(name)) : []),
  ],
})
export class QueuesModule {}
