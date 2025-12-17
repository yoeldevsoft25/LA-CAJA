import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from '../database/entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de mesas
 */
@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  /**
   * Crea una nueva mesa
   */
  async createTable(storeId: string, dto: CreateTableDto): Promise<Table> {
    // Verificar que no exista una mesa con el mismo número
    const existing = await this.tableRepository.findOne({
      where: {
        store_id: storeId,
        table_number: dto.table_number,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una mesa con número "${dto.table_number}"`,
      );
    }

    const table = this.tableRepository.create({
      id: randomUUID(),
      store_id: storeId,
      table_number: dto.table_number,
      name: dto.name || null,
      capacity: dto.capacity || null,
      status: dto.status || 'available',
      note: dto.note || null,
    });

    return this.tableRepository.save(table);
  }

  /**
   * Obtiene todas las mesas de una tienda
   */
  async getTablesByStore(storeId: string): Promise<Table[]> {
    return this.tableRepository.find({
      where: { store_id: storeId },
      order: { table_number: 'ASC' },
      relations: ['currentOrder'],
    });
  }

  /**
   * Obtiene una mesa por ID
   */
  async getTableById(storeId: string, tableId: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId, store_id: storeId },
      relations: ['currentOrder'],
    });

    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }

    return table;
  }

  /**
   * Obtiene mesas por estado
   */
  async getTablesByStatus(
    storeId: string,
    status: TableStatus,
  ): Promise<Table[]> {
    return this.tableRepository.find({
      where: { store_id: storeId, status },
      order: { table_number: 'ASC' },
      relations: ['currentOrder'],
    });
  }

  /**
   * Actualiza una mesa
   */
  async updateTable(
    storeId: string,
    tableId: string,
    dto: UpdateTableDto,
  ): Promise<Table> {
    const table = await this.getTableById(storeId, tableId);

    // Si se está cambiando el número, verificar que no exista otro
    if (dto.table_number && dto.table_number !== table.table_number) {
      const existing = await this.tableRepository.findOne({
        where: {
          store_id: storeId,
          table_number: dto.table_number,
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Ya existe una mesa con número "${dto.table_number}"`,
        );
      }

      table.table_number = dto.table_number;
    }

    if (dto.name !== undefined) table.name = dto.name;
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.status !== undefined) table.status = dto.status;
    if (dto.note !== undefined) table.note = dto.note;

    table.updated_at = new Date();

    return this.tableRepository.save(table);
  }

  /**
   * Actualiza el estado de una mesa
   */
  async updateTableStatus(
    storeId: string,
    tableId: string,
    status: TableStatus,
  ): Promise<Table> {
    const table = await this.getTableById(storeId, tableId);
    table.status = status;
    table.updated_at = new Date();
    return this.tableRepository.save(table);
  }

  /**
   * Actualiza la orden actual de una mesa
   */
  async updateTableCurrentOrder(
    storeId: string,
    tableId: string,
    orderId: string | null,
  ): Promise<Table> {
    const table = await this.getTableById(storeId, tableId);
    table.current_order_id = orderId;
    table.status = orderId ? 'occupied' : 'available';
    table.updated_at = new Date();
    return this.tableRepository.save(table);
  }

  /**
   * Elimina una mesa
   */
  async deleteTable(storeId: string, tableId: string): Promise<void> {
    const table = await this.getTableById(storeId, tableId);

    // Verificar que no tenga una orden activa
    if (table.current_order_id) {
      throw new BadRequestException(
        'No se puede eliminar una mesa con una orden activa',
      );
    }

    await this.tableRepository.remove(table);
  }
}

