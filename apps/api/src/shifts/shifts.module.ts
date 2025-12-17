import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { Shift } from '../database/entities/shift.entity';
import { ShiftCut } from '../database/entities/shift-cut.entity';
import { Sale } from '../database/entities/sale.entity';

/**
 * Módulo para gestión de turnos de cajeros y cortes X/Z
 */
@Module({
  imports: [TypeOrmModule.forFeature([Shift, ShiftCut, Sale])],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
