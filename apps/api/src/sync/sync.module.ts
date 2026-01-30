import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QueuesModule } from '../queues/queues.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { Event } from '../database/entities/event.entity';
import { ProjectionsModule } from '../projections/projections.module';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Product, CashSession]),
    ProjectionsModule,
    DiscountsModule,
    QueuesModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    VectorClockService,
    CRDTService,
    ConflictResolutionService,
  ],
  exports: [
    SyncService,
    VectorClockService,
    CRDTService,
    ConflictResolutionService,
  ],
})
export class SyncModule { }
