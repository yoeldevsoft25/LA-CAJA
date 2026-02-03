import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from '../database/entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { QRCodesService } from './qr-codes.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de mesas
 */
@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    private qrCodesService: QRCodesService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
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
      zone: dto.zone || null,
      coordinates: dto.coordinates || null,
      estimated_dining_time: dto.estimated_dining_time || null,
      note: dto.note || null,
    });

    const savedTable = await this.tableRepository.save(table);

    // Generar código QR automáticamente para la nueva mesa
    try {
      await this.qrCodesService.createOrUpdateQRCode(storeId, savedTable.id);
      // Recargar la mesa con el QR code
      const tableWithQR = await this.getTableById(storeId, savedTable.id);
      // Emitir evento WebSocket
      this.notificationsGateway.emitTableUpdate(storeId, tableWithQR);
      return tableWithQR;
    } catch (error) {
      // Si falla la generación del QR, la mesa se crea igual
      // Emitir evento WebSocket
      this.notificationsGateway.emitTableUpdate(storeId, savedTable);
      return savedTable;
    }
  }

  /**
   * Obtiene todas las mesas de una tienda
   */
  async getTablesByStore(storeId: string): Promise<Table[]> {
    const tables = await this.tableRepository.find({
      where: { store_id: storeId },
      order: { table_number: 'ASC' },
      relations: ['currentOrder', 'qrCode'],
    });

    // Actualizar URLs de QR codes si es necesario (en segundo plano, sin bloquear)
    for (const table of tables) {
      if (table.qrCode) {
        try {
          await this.qrCodesService.getQRCodeByTable(storeId, table.id);
          // Actualizar la referencia en memoria
          const updatedQR = await this.qrCodesService.getQRCodeByTable(
            storeId,
            table.id,
          );
          table.qrCode = updatedQR;
        } catch (error) {
          // Ignorar errores si no hay QR code
        }
      }
    }

    return tables;
  }

  /**
   * Obtiene una mesa por ID
   */
  async getTableById(storeId: string, tableId: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId, store_id: storeId },
      relations: ['currentOrder', 'qrCode'],
    });

    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }

    // Actualizar URL del QR code si es necesario
    if (table.qrCode) {
      try {
        const updatedQR = await this.qrCodesService.getQRCodeByTable(
          storeId,
          tableId,
        );
        // Actualizar la referencia en memoria
        table.qrCode = updatedQR;
      } catch (error) {
        // Ignorar errores si no hay QR code
      }
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
    const tables = await this.tableRepository.find({
      where: { store_id: storeId, status },
      order: { table_number: 'ASC' },
      relations: ['currentOrder', 'qrCode'],
    });

    // Actualizar URLs de QR codes si es necesario (en segundo plano, sin bloquear)
    for (const table of tables) {
      if (table.qrCode) {
        try {
          const updatedQR = await this.qrCodesService.getQRCodeByTable(
            storeId,
            table.id,
          );
          // Actualizar la referencia en memoria
          table.qrCode = updatedQR;
        } catch (error) {
          // Ignorar errores si no hay QR code
        }
      }
    }

    return tables;
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
    if (dto.zone !== undefined) table.zone = dto.zone;
    if (dto.coordinates !== undefined) table.coordinates = dto.coordinates;
    if (dto.estimated_dining_time !== undefined)
      table.estimated_dining_time = dto.estimated_dining_time;
    if (dto.note !== undefined) table.note = dto.note;

    table.updated_at = new Date();

    const savedTable = await this.tableRepository.save(table);

    // Emitir evento WebSocket
    this.notificationsGateway.emitTableUpdate(storeId, savedTable);
    if (dto.status !== undefined) {
      this.notificationsGateway.emitTableStatusChange(
        storeId,
        tableId,
        dto.status,
      );
    }

    return savedTable;
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
    const savedTable = await this.tableRepository.save(table);

    // Emitir eventos WebSocket
    this.notificationsGateway.emitTableUpdate(storeId, savedTable);
    this.notificationsGateway.emitTableStatusChange(storeId, tableId, status);

    return savedTable;
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
    const savedTable = await this.tableRepository.save(table);

    // Emitir eventos WebSocket
    this.notificationsGateway.emitTableUpdate(storeId, savedTable);
    this.notificationsGateway.emitTableStatusChange(
      storeId,
      tableId,
      savedTable.status,
    );

    return savedTable;
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
