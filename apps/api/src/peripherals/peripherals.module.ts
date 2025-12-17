import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeripheralsController } from './peripherals.controller';
import { PeripheralsService } from './peripherals.service';
import { PeripheralConfig } from '../database/entities/peripheral-config.entity';

/**
 * Módulo para gestión de periféricos
 */
@Module({
  imports: [TypeOrmModule.forFeature([PeripheralConfig])],
  controllers: [PeripheralsController],
  providers: [PeripheralsService],
  exports: [PeripheralsService],
})
export class PeripheralsModule {}
