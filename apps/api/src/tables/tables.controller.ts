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
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableStatus } from '../database/entities/table.entity';

/**
 * Controlador para gestión de mesas
 */
@Controller('tables')
@UseGuards(JwtAuthGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  /**
   * Crea una nueva mesa
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTable(@Body() dto: CreateTableDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.tablesService.createTable(storeId, dto);
  }

  /**
   * Obtiene todas las mesas de la tienda
   */
  @Get()
  async getTablesByStore(
    @Request() req: any,
    @Query('status') status?: TableStatus,
  ) {
    const storeId = req.user.store_id;
    if (status) {
      return this.tablesService.getTablesByStatus(storeId, status);
    }
    return this.tablesService.getTablesByStore(storeId);
  }

  /**
   * Obtiene una mesa por ID
   */
  @Get(':id')
  async getTableById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.tablesService.getTableById(storeId, id);
  }

  /**
   * Actualiza una mesa
   */
  @Put(':id')
  async updateTable(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.tablesService.updateTable(storeId, id, dto);
  }

  /**
   * Actualiza el estado de una mesa
   */
  @Put(':id/status')
  async updateTableStatus(
    @Param('id') id: string,
    @Body() body: { status: TableStatus },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.tablesService.updateTableStatus(storeId, id, body.status);
  }

  /**
   * Elimina una mesa
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTable(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.tablesService.deleteTable(storeId, id);
  }
}
