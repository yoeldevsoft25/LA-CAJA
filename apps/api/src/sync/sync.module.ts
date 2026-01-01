import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { Event } from '../database/entities/event.entity';
import { ProjectionsModule } from '../projections/projections.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), ProjectionsModule],
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
export class SyncModule {}
