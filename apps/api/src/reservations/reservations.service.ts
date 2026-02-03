import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  Reservation,
  ReservationStatus,
} from '../database/entities/reservation.entity';
import { Table } from '../database/entities/table.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de reservas
 */
@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  /**
   * Crea una nueva reserva
   */
  async createReservation(
    storeId: string,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    // Validar fecha y hora
    const reservationDate = new Date(dto.reservation_date);
    const now = new Date();
    if (reservationDate < now) {
      throw new BadRequestException(
        'La fecha de reserva no puede ser en el pasado',
      );
    }

    // Si se especifica una mesa, verificar disponibilidad
    if (dto.table_id) {
      const table = await this.tableRepository.findOne({
        where: { id: dto.table_id, store_id: storeId },
      });

      if (!table) {
        throw new NotFoundException('Mesa no encontrada');
      }

      // Verificar si hay conflicto de reservas
      const conflictingReservation = await this.reservationRepository.findOne({
        where: {
          table_id: dto.table_id,
          reservation_date: reservationDate,
          reservation_time: dto.reservation_time,
          status: Between('pending', 'confirmed' as ReservationStatus),
        },
      });

      if (conflictingReservation) {
        throw new BadRequestException(
          'La mesa ya tiene una reserva en esa fecha y hora',
        );
      }
    }

    const reservation = this.reservationRepository.create({
      id: randomUUID(),
      store_id: storeId,
      table_id: dto.table_id || null,
      customer_id: dto.customer_id || null,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone || null,
      reservation_date: reservationDate,
      reservation_time: dto.reservation_time,
      party_size: dto.party_size,
      status: dto.status || 'pending',
      special_requests: dto.special_requests || null,
      note: dto.note || null,
    });

    return this.reservationRepository.save(reservation);
  }

  /**
   * Obtiene todas las reservas de una tienda
   */
  async getReservationsByStore(
    storeId: string,
    date?: Date,
  ): Promise<Reservation[]> {
    const where: any = { store_id: storeId };

    if (date) {
      where.reservation_date = date;
    }

    return this.reservationRepository.find({
      where,
      relations: ['table', 'customer'],
      order: {
        reservation_date: 'ASC',
        reservation_time: 'ASC',
      },
    });
  }

  /**
   * Obtiene una reserva por ID
   */
  async getReservationById(
    storeId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId, store_id: storeId },
      relations: ['table', 'customer'],
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return reservation;
  }

  /**
   * Actualiza una reserva
   */
  async updateReservation(
    storeId: string,
    reservationId: string,
    dto: UpdateReservationDto,
  ): Promise<Reservation> {
    const reservation = await this.getReservationById(storeId, reservationId);

    if (dto.table_id !== undefined) {
      reservation.table_id = dto.table_id;
    }
    if (dto.customer_name !== undefined) {
      reservation.customer_name = dto.customer_name;
    }
    if (dto.customer_phone !== undefined) {
      reservation.customer_phone = dto.customer_phone;
    }
    if (dto.reservation_date !== undefined) {
      reservation.reservation_date = new Date(dto.reservation_date);
    }
    if (dto.reservation_time !== undefined) {
      reservation.reservation_time = dto.reservation_time;
    }
    if (dto.party_size !== undefined) {
      reservation.party_size = dto.party_size;
    }
    if (dto.status !== undefined) {
      reservation.status = dto.status;
    }
    if (dto.special_requests !== undefined) {
      reservation.special_requests = dto.special_requests;
    }
    if (dto.note !== undefined) {
      reservation.note = dto.note;
    }

    reservation.updated_at = new Date();

    return this.reservationRepository.save(reservation);
  }

  /**
   * Asigna automáticamente una mesa a una reserva
   */
  async assignTable(
    storeId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.getReservationById(storeId, reservationId);

    if (reservation.table_id) {
      throw new BadRequestException('La reserva ya tiene una mesa asignada');
    }

    // Buscar mesa disponible que pueda acomodar el party_size
    const availableTables = await this.tableRepository.find({
      where: {
        store_id: storeId,
        status: 'available',
      },
      order: { capacity: 'ASC' },
    });

    const suitableTable = availableTables.find(
      (table) => table.capacity && table.capacity >= reservation.party_size,
    );

    if (!suitableTable) {
      throw new BadRequestException(
        'No hay mesas disponibles para el tamaño del grupo',
      );
    }

    reservation.table_id = suitableTable.id;
    reservation.status = 'confirmed';
    reservation.updated_at = new Date();

    return this.reservationRepository.save(reservation);
  }

  /**
   * Cancela una reserva
   */
  async cancelReservation(
    storeId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.getReservationById(storeId, reservationId);

    if (reservation.status === 'cancelled') {
      throw new BadRequestException('La reserva ya está cancelada');
    }

    reservation.status = 'cancelled';
    reservation.updated_at = new Date();

    return this.reservationRepository.save(reservation);
  }

  /**
   * Marca una reserva como completada (cliente se sentó)
   */
  async markAsSeated(
    storeId: string,
    reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.getReservationById(storeId, reservationId);

    if (!reservation.table_id) {
      throw new BadRequestException('La reserva debe tener una mesa asignada');
    }

    reservation.status = 'seated';
    reservation.updated_at = new Date();

    // Actualizar estado de la mesa
    const table = await this.tableRepository.findOne({
      where: { id: reservation.table_id },
    });

    if (table) {
      table.status = 'occupied';
      await this.tableRepository.save(table);
    }

    return this.reservationRepository.save(reservation);
  }

  /**
   * Elimina una reserva
   */
  async deleteReservation(
    storeId: string,
    reservationId: string,
  ): Promise<void> {
    const reservation = await this.getReservationById(storeId, reservationId);

    if (reservation.status === 'seated') {
      throw new BadRequestException(
        'No se puede eliminar una reserva que ya está sentada',
      );
    }

    await this.reservationRepository.remove(reservation);
  }
}
