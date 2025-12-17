import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transfer, TransferStatus } from '../database/entities/transfer.entity';
import { TransferItem } from '../database/entities/transfer-item.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { Product } from '../database/entities/product.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ShipTransferDto } from './dto/ship-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de transferencias entre bodegas
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(Transfer)
    private transferRepository: Repository<Transfer>,
    @InjectRepository(TransferItem)
    private transferItemRepository: Repository<TransferItem>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private warehousesService: WarehousesService,
    private dataSource: DataSource,
  ) {}

  /**
   * Genera un número único de transferencia
   */
  private async generateTransferNumber(storeId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.transferRepository.count({
      where: { store_id: storeId },
    });
    return `TRANSF-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Crea una nueva transferencia
   */
  async create(
    storeId: string,
    dto: CreateTransferDto,
    userId: string,
  ): Promise<Transfer> {
    // Validar bodegas
    if (dto.from_warehouse_id === dto.to_warehouse_id) {
      throw new BadRequestException(
        'La bodega origen y destino no pueden ser la misma',
      );
    }

    const fromWarehouse = await this.warehouseRepository.findOne({
      where: { id: dto.from_warehouse_id, store_id: storeId },
    });

    if (!fromWarehouse) {
      throw new NotFoundException('Bodega origen no encontrada');
    }

    const toWarehouse = await this.warehouseRepository.findOne({
      where: { id: dto.to_warehouse_id, store_id: storeId },
    });

    if (!toWarehouse) {
      throw new NotFoundException('Bodega destino no encontrada');
    }

    // Validar items y stock disponible
    for (const item of dto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.product_id, store_id: storeId },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto ${item.product_id} no encontrado`,
        );
      }

      // Verificar stock disponible en bodega origen
      const stock = await this.warehousesService.getStock(
        storeId,
        dto.from_warehouse_id,
        item.product_id,
      );

      const availableStock = stock.find(
        (s) =>
          s.product_id === item.product_id &&
          (s.variant_id === item.variant_id ||
            (!s.variant_id && !item.variant_id)),
      );

      if (!availableStock || availableStock.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${product.name}`,
        );
      }
    }

    // Crear transferencia
    const transferNumber = await this.generateTransferNumber(storeId);
    const transfer = this.transferRepository.create({
      id: randomUUID(),
      store_id: storeId,
      transfer_number: transferNumber,
      from_warehouse_id: dto.from_warehouse_id,
      to_warehouse_id: dto.to_warehouse_id,
      status: 'pending',
      requested_by: userId,
      requested_at: new Date(),
      note: dto.note || null,
    });

    const savedTransfer = await this.transferRepository.save(transfer);

    // Crear items y reservar stock
    const items: TransferItem[] = [];
    for (const itemDto of dto.items) {
      const product = await this.productRepository.findOne({
        where: { id: itemDto.product_id },
        select: ['cost_bs', 'cost_usd'],
      });

      const item = this.transferItemRepository.create({
        id: randomUUID(),
        transfer_id: savedTransfer.id,
        product_id: itemDto.product_id,
        variant_id: itemDto.variant_id || null,
        quantity: itemDto.quantity,
        quantity_shipped: 0,
        quantity_received: 0,
        unit_cost_bs: itemDto.unit_cost_bs ?? product?.cost_bs ?? 0,
        unit_cost_usd: itemDto.unit_cost_usd ?? product?.cost_usd ?? 0,
        note: itemDto.note || null,
      });

      const savedItem = await this.transferItemRepository.save(item);
      items.push(savedItem);

      // Reservar stock en bodega origen
      await this.warehousesService.reserveStock(
        dto.from_warehouse_id,
        itemDto.product_id,
        itemDto.variant_id || null,
        itemDto.quantity,
      );
    }

    savedTransfer.items = items;
    return savedTransfer;
  }

  /**
   * Marca una transferencia como enviada
   */
  async ship(
    storeId: string,
    transferId: string,
    dto: ShipTransferDto,
    userId: string,
  ): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId, store_id: storeId },
      relations: ['items'],
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException(
        `Solo se pueden enviar transferencias pendientes. Estado actual: ${transfer.status}`,
      );
    }

    // Validar cantidades enviadas
    if (dto.items.length !== transfer.items.length) {
      throw new BadRequestException(
        'La cantidad de items no coincide con la transferencia',
      );
    }

    // Actualizar items
    for (let i = 0; i < transfer.items.length; i++) {
      const item = transfer.items[i];
      const shippedDto = dto.items[i];

      if (shippedDto.quantity_shipped > item.quantity) {
        throw new BadRequestException(
          `La cantidad enviada no puede ser mayor a la solicitada para el item ${i + 1}`,
        );
      }

      item.quantity_shipped = shippedDto.quantity_shipped;
      await this.transferItemRepository.save(item);
    }

    // Actualizar transferencia
    transfer.status = 'in_transit';
    transfer.shipped_by = userId;
    transfer.shipped_at = new Date();
    if (dto.note) {
      transfer.note = (transfer.note ? transfer.note + '\n' : '') + dto.note;
    }

    return this.transferRepository.save(transfer);
  }

  /**
   * Marca una transferencia como recibida
   */
  async receive(
    storeId: string,
    transferId: string,
    dto: ReceiveTransferDto,
    userId: string,
  ): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId, store_id: storeId },
      relations: ['items'],
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transfer.status !== 'in_transit') {
      throw new BadRequestException(
        `Solo se pueden recibir transferencias en tránsito. Estado actual: ${transfer.status}`,
      );
    }

    // Validar cantidades recibidas
    if (dto.items.length !== transfer.items.length) {
      throw new BadRequestException(
        'La cantidad de items no coincide con la transferencia',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Actualizar items y stock
      for (let i = 0; i < transfer.items.length; i++) {
        const item = transfer.items[i];
        const receivedDto = dto.items[i];

        if (receivedDto.quantity_received > item.quantity_shipped) {
          throw new BadRequestException(
            `La cantidad recibida no puede ser mayor a la enviada para el item ${i + 1}`,
          );
        }

        item.quantity_received = receivedDto.quantity_received;
        await manager.save(TransferItem, item);

        // Liberar stock reservado en bodega origen
        await this.warehousesService.releaseReservedStock(
          transfer.from_warehouse_id,
          item.product_id,
          item.variant_id,
          item.quantity,
        );

        // Si se recibió menos de lo enviado, ajustar stock en origen
        if (receivedDto.quantity_received < item.quantity_shipped) {
          const difference =
            item.quantity_shipped - receivedDto.quantity_received;
          await this.warehousesService.updateStock(
            transfer.from_warehouse_id,
            item.product_id,
            item.variant_id,
            difference, // Devolver diferencia a stock disponible
          );
        }

        // Agregar stock a bodega destino
        await this.warehousesService.updateStock(
          transfer.to_warehouse_id,
          item.product_id,
          item.variant_id,
          receivedDto.quantity_received,
        );
      }

      // Actualizar transferencia
      transfer.status = 'completed';
      transfer.received_by = userId;
      transfer.received_at = new Date();
      if (dto.note) {
        transfer.note = (transfer.note ? transfer.note + '\n' : '') + dto.note;
      }

      return manager.save(Transfer, transfer);
    });
  }

  /**
   * Cancela una transferencia
   */
  async cancel(
    storeId: string,
    transferId: string,
    userId: string,
  ): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId, store_id: storeId },
      relations: ['items'],
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transfer.status === 'completed') {
      throw new BadRequestException(
        'No se puede cancelar una transferencia completada',
      );
    }

    if (transfer.status === 'cancelled') {
      throw new BadRequestException('La transferencia ya está cancelada');
    }

    return this.dataSource.transaction(async (manager) => {
      // Liberar stock reservado
      for (const item of transfer.items) {
        await this.warehousesService.releaseReservedStock(
          transfer.from_warehouse_id,
          item.product_id,
          item.variant_id,
          item.quantity,
        );
      }

      // Marcar como cancelada
      transfer.status = 'cancelled';
      return manager.save(Transfer, transfer);
    });
  }

  /**
   * Obtiene todas las transferencias de una tienda
   */
  async findAll(
    storeId: string,
    status?: TransferStatus,
    warehouseId?: string,
  ): Promise<Transfer[]> {
    const where: any = { store_id: storeId };
    if (status) {
      where.status = status;
    }
    if (warehouseId) {
      where.from_warehouse_id = warehouseId;
    }

    return this.transferRepository.find({
      where,
      relations: ['items', 'from_warehouse', 'to_warehouse'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene una transferencia por ID
   */
  async findOne(storeId: string, transferId: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId, store_id: storeId },
      relations: [
        'items',
        'from_warehouse',
        'to_warehouse',
        'requester',
        'shipper',
        'receiver',
      ],
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    return transfer;
  }
}
