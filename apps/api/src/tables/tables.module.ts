import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';
import { Table } from '../database/entities/table.entity';

/**
 * Módulo para gestión de mesas
 */
@Module({
  imports: [TypeOrmModule.forFeature([Table])],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}

