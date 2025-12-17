import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { Event } from '../database/entities/event.entity';
import { ProjectionsModule } from '../projections/projections.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), ProjectionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
