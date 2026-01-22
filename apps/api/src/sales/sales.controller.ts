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
  ForbiddenException,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { ReturnSaleDto } from './dto/return-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SecurityAuditService } from '../security/security-audit.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSaleDto, @Request() req: any) {
    // ⚠️ VALIDACIÓN CRÍTICA: Verificar que req.user existe y tiene los datos necesarios
    if (!req.user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const storeId = req.user.store_id;
    const userId = req.user.sub; // ID del usuario que hace la venta
    const userRole = req.user.role;

    // ⚠️ VALIDACIÓN CRÍTICA: userId es obligatorio para TODAS las ventas
    if (!userId) {
      throw new UnauthorizedException(
        'No se pudo identificar al usuario. El token de autenticación no contiene el ID del usuario.',
      );
    }

    // ⚠️ VALIDACIÓN CRÍTICA: storeId es obligatorio
    if (!storeId) {
      throw new UnauthorizedException(
        'No se pudo identificar la tienda. El token de autenticación no contiene el ID de la tienda.',
      );
    }

    return this.salesService.create(storeId, dto, userId, userRole);
  }

  @Get()
  async findAll(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Request() req: any,
  ) {
    const userStoreId = req.user.store_id;

    // SIEMPRE usar solo la tienda del usuario - NO permitir ver otras tiendas
    // Todos los usuarios (owners y cashiers) solo pueden ver ventas de su propia tienda
    if (!userStoreId) {
      throw new UnauthorizedException('Store ID no válido');
    }

    const targetStoreId = userStoreId;

    // Ajustar fechas: desde inicio del día, hasta fin del día
    let dateFromAdjusted: Date | undefined;
    let dateToAdjusted: Date | undefined;

    if (dateFrom) {
      // Crear fecha en UTC para evitar problemas de timezone
      const dateParts = dateFrom.split('-');
      dateFromAdjusted = new Date(
        Date.UTC(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1, // Los meses son 0-indexed
          parseInt(dateParts[2], 10),
          0,
          0,
          0,
          0, // Inicio del día en UTC
        ),
      );
    }

    if (dateTo) {
      // Crear fecha en UTC para evitar problemas de timezone
      const dateParts = dateTo.split('-');
      dateToAdjusted = new Date(
        Date.UTC(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1, // Los meses son 0-indexed
          parseInt(dateParts[2], 10),
          23,
          59,
          59,
          999, // Fin del día en UTC
        ),
      );
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
    
    // Validar que storeId esté presente
    if (!storeId) {
      throw new UnauthorizedException('Store ID no válido');
    }
    
    // El servicio valida store_id en la query, pero reforzamos aquí
    const sale = await this.salesService.findOne(storeId, id);
    
    // Validación adicional: TODOS los usuarios solo pueden ver ventas de su tienda
    if (sale.store_id !== storeId) {
      throw new UnauthorizedException(
        'No tienes permisos para ver esta venta',
      );
    }
    
    return sale;
  }

  @Post(':id/void')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async voidSale(
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
    @Request() req: any,
  ) {
    if (req.user.role !== 'owner') {
      await this.securityAuditService.log({
        event_type: 'sale_void_attempt',
        store_id: req.user.store_id,
        user_id: req.user.sub,
        status: 'blocked',
        details: {
          sale_id: id,
          reason: dto.reason || null,
        },
      });
      throw new ForbiddenException('Solo el owner puede anular ventas');
    }
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    
    // Validar que storeId esté presente
    if (!storeId) {
      throw new UnauthorizedException('Store ID no válido');
    }
    
    // Obtener la venta para validar que pertenece a la tienda del usuario
    const sale = await this.salesService.findOne(storeId, id);
    
    // Validación adicional: asegurar que la venta pertenece a la tienda del usuario
    if (sale.store_id !== storeId) {
      throw new UnauthorizedException(
        'No tienes permisos para anular esta venta',
      );
    }
    
    return this.salesService.voidSale(storeId, id, userId, dto.reason);
  }

  @Post(':id/return')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async returnSaleItems(
    @Param('id') id: string,
    @Body() dto: ReturnSaleDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    
    // Validar que storeId esté presente
    if (!storeId) {
      throw new UnauthorizedException('Store ID no válido');
    }
    
    // Obtener la venta para validar que pertenece a la tienda del usuario
    const sale = await this.salesService.findOne(storeId, id);
    
    // Validación adicional: asegurar que la venta pertenece a la tienda del usuario
    if (sale.store_id !== storeId) {
      throw new UnauthorizedException(
        'No tienes permisos para devolver items de esta venta',
      );
    }
    
    return this.salesService.returnItems(storeId, id, dto, userId);
  }
}
