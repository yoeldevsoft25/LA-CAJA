import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'sales-projections' },
      { name: 'sales-post-processing' },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
