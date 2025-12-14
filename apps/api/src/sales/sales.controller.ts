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
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSaleDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.sub; // ID del usuario que hace la venta
    return this.salesService.create(storeId, dto, userId);
  }

  @Get()
  async findAll(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('store_id') requestedStoreId: string,
    @Request() req: any,
  ) {
    const userRole = req.user.role;
    const userStoreId = req.user.store_id;
    
    // Validar permisos: solo owners pueden ver otras tiendas
    let targetStoreId = userStoreId;
    if (requestedStoreId && requestedStoreId !== userStoreId) {
      if (userRole !== 'owner') {
        throw new UnauthorizedException('No tienes permisos para ver ventas de otras tiendas');
      }
      targetStoreId = requestedStoreId;
    }
    
    // Ajustar fechas: desde inicio del día, hasta fin del día
    let dateFromAdjusted: Date | undefined;
    let dateToAdjusted: Date | undefined;
    
    if (dateFrom) {
      // Crear fecha en UTC para evitar problemas de timezone
      const dateParts = dateFrom.split('-');
      dateFromAdjusted = new Date(Date.UTC(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1, // Los meses son 0-indexed
        parseInt(dateParts[2], 10),
        0, 0, 0, 0 // Inicio del día en UTC
      ));
    }
    
    if (dateTo) {
      // Crear fecha en UTC para evitar problemas de timezone
      const dateParts = dateTo.split('-');
      dateToAdjusted = new Date(Date.UTC(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1, // Los meses son 0-indexed
        parseInt(dateParts[2], 10),
        23, 59, 59, 999 // Fin del día en UTC
      ));
    }
    
    return this.salesService.findAll(
      targetStoreId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      dateFromAdjusted,
      dateToAdjusted,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.salesService.findOne(storeId, id);
  }
}

