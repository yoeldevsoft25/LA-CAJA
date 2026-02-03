import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { Reservation } from '../database/entities/reservation.entity';
import { Table } from '../database/entities/table.entity';
import { Customer } from '../database/entities/customer.entity';

/**
 * Módulo para gestión de reservas
 */
@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Table, Customer])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
