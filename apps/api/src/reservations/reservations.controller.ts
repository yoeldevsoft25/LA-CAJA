import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de reservas
 */
@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  /**
   * Crea una nueva reserva
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReservation(
    @Body() dto: CreateReservationDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.reservationsService.createReservation(storeId, dto);
  }

  /**
   * Obtiene todas las reservas de la tienda
   */
  @Get()
  async getReservations(@Request() req: any, @Query('date') date?: string) {
    const storeId = req.user.store_id;
    const reservationDate = date ? new Date(date) : undefined;
    return this.reservationsService.getReservationsByStore(
      storeId,
      reservationDate,
    );
  }

  /**
   * Obtiene una reserva por ID
   */
  @Get(':id')
  async getReservationById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.reservationsService.getReservationById(storeId, id);
  }

  /**
   * Actualiza una reserva
   */
  @Put(':id')
  async updateReservation(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.reservationsService.updateReservation(storeId, id, dto);
  }

  /**
   * Asigna automáticamente una mesa a una reserva
   */
  @Post(':id/assign-table')
  async assignTable(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.reservationsService.assignTable(storeId, id);
  }

  /**
   * Marca una reserva como sentada
   */
  @Post(':id/seat')
  async markAsSeated(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.reservationsService.markAsSeated(storeId, id);
  }

  /**
   * Cancela una reserva
   */
  @Post(':id/cancel')
  async cancelReservation(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.reservationsService.cancelReservation(storeId, id);
  }

  /**
   * Elimina una reserva
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReservation(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.reservationsService.deleteReservation(storeId, id);
  }
}
