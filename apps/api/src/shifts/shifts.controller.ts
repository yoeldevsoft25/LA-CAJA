import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de turnos de cajeros y cortes X/Z
 */
@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  /**
   * Abre un nuevo turno para el cajero autenticado
   */
  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  async openShift(@Body() dto: OpenShiftDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub; // ID del usuario autenticado (cajero)
    return this.shiftsService.openShift(storeId, cashierId, dto);
  }

  /**
   * Obtiene el turno actual abierto del cajero autenticado
   */
  @Get('current')
  async getCurrentShift(@Request() req: any) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub;
    return this.shiftsService.getCurrentShift(storeId, cashierId);
  }

  /**
   * Cierra un turno con arqueo
   */
  @Post(':id/close')
  async closeShift(
    @Param('id') shiftId: string,
    @Body() dto: CloseShiftDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub;
    return this.shiftsService.closeShift(storeId, cashierId, shiftId, dto);
  }

  /**
   * Crea un corte X (intermedio) para un turno
   */
  @Post(':id/cut-x')
  @HttpCode(HttpStatus.CREATED)
  async createCutX(@Param('id') shiftId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub;
    const userId = req.user.sub;
    return this.shiftsService.createCutX(storeId, cashierId, shiftId, userId);
  }

  /**
   * Crea un corte Z (final) para un turno cerrado
   */
  @Post(':id/cut-z')
  @HttpCode(HttpStatus.CREATED)
  async createCutZ(@Param('id') shiftId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub;
    const userId = req.user.sub;
    return this.shiftsService.createCutZ(storeId, cashierId, shiftId, userId);
  }

  /**
   * Obtiene todos los cortes de un turno
   */
  @Get(':id/cuts')
  async getCuts(@Param('id') shiftId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.shiftsService.getCuts(shiftId, storeId);
  }

  /**
   * Marca un corte como impreso (reimpresión)
   */
  @Post(':id/cuts/:cutId/reprint')
  async reprintCut(
    @Param('id') shiftId: string,
    @Param('cutId') cutId: string,
    @Request() req: any,
  ) {
    return this.shiftsService.markCutAsPrinted(cutId, shiftId);
  }

  /**
   * Obtiene el resumen completo de un turno
   */
  @Get(':id/summary')
  async getShiftSummary(@Param('id') shiftId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.shiftsService.getShiftSummary(shiftId, storeId);
  }

  /**
   * Lista los turnos del cajero autenticado
   */
  @Get()
  async listShifts(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const cashierId = req.user.sub;
    return this.shiftsService.listShifts(
      storeId,
      cashierId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
