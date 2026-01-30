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
import { Product } from '../database/entities/product.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ShipTransferDto } from './dto/ship-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { AccountingService } from '../accounting/accounting.service';
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
    private warehousesService: WarehousesService,
    private accountingService: AccountingService,
    private dataSource: DataSource,
  ) { }

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

    const transferNumber = await this.generateTransferNumber(storeId);
    return this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(Transfer);
      const transferItemRepo = manager.getRepository(TransferItem);
      const productRepo = manager.getRepository(Product);

      // Crear transferencia
      const transfer = transferRepo.create({
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

      const savedTransfer = await transferRepo.save(transfer);

      // Crear items y reservar stock
      const items: TransferItem[] = [];
      for (const itemDto of dto.items) {
        const product = await productRepo.findOne({
          where: { id: itemDto.product_id, store_id: storeId },
          select: ['id', 'name', 'cost_bs', 'cost_usd'],
        });

        if (!product) {
          throw new NotFoundException(
            `Producto ${itemDto.product_id} no encontrado`,
          );
        }

        // Reservar stock en bodega origen con bloqueo transaccional
        try {
          await this.warehousesService.reserveStock(
            dto.from_warehouse_id,
            itemDto.product_id,
            itemDto.variant_id || null,
            itemDto.quantity,
            storeId,
            manager,
          );
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw new BadRequestException(
              `Stock insuficiente para el producto ${product.name}`,
            );
          }
          throw error;
        }

        const item = transferItemRepo.create({
          id: randomUUID(),
          transfer_id: savedTransfer.id,
          product_id: itemDto.product_id,
          variant_id: itemDto.variant_id || null,
          quantity: itemDto.quantity,
          quantity_shipped: 0,
          quantity_received: 0,
          unit_cost_bs: itemDto.unit_cost_bs ?? product.cost_bs ?? 0,
          unit_cost_usd: itemDto.unit_cost_usd ?? product.cost_usd ?? 0,
          note: itemDto.note || null,
        });

        const savedItem = await transferItemRepo.save(item);
        items.push(savedItem);
      }

      savedTransfer.items = items;
      return savedTransfer;
    });
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
      // Usar repo de movimientos dentro de la transacción
      const movementRepo = manager.getRepository('InventoryMovement');

      // Actualizar items y stock
      // Actualizar items y stock
      for (const item of transfer.items) {
        const receivedDto = dto.items.find((i) => i.product_id === item.product_id);

        if (!receivedDto) {
          throw new BadRequestException(
            `Falta información de recepción para el producto ${item.product_id}`,
          );
        }

        if (receivedDto.quantity_received > item.quantity_shipped) {
          throw new BadRequestException(
            `La cantidad recibida no puede ser mayor a la enviada para el item, producto: ${item.product_id}`,
          );
        }

        item.quantity_received = receivedDto.quantity_received;
        await manager.save(TransferItem, item);

        const shippedQty = Number(item.quantity_shipped || 0);
        const reservedQty = Number(item.quantity || 0);

        // 1. Consumir stock reservado en origen (commit) solo por lo enviado
        await this.warehousesService.commitReservedStock(
          transfer.from_warehouse_id,
          item.product_id,
          item.variant_id,
          shippedQty,
          manager,
        );

        // 2. Si se reservó más de lo enviado, liberar la diferencia
        if (reservedQty > shippedQty) {
          const unshipped = reservedQty - shippedQty;
          await this.warehousesService.releaseReservedStock(
            transfer.from_warehouse_id,
            item.product_id,
            item.variant_id,
            unshipped,
            manager,
          );
        }

        // 3. Si se recibió menos, devolver la diferencia al stock disponible en origen
        if (receivedDto.quantity_received < item.quantity_shipped) {
          const difference = item.quantity_shipped - receivedDto.quantity_received;
          await this.warehousesService.updateStock(
            transfer.from_warehouse_id,
            item.product_id,
            item.variant_id,
            difference,
            storeId,
            manager
          );
        }

        // 4. Agregar stock a bodega destino
        await this.warehousesService.updateStock(
          transfer.to_warehouse_id,
          item.product_id,
          item.variant_id,
          receivedDto.quantity_received,
          storeId,
          manager
        );

        // 5. Registrar Movimiento de Salida (Transfer Out) - Origen
        const movementOut = movementRepo.create({
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          movement_type: 'transfer_out',
          qty_delta: -receivedDto.quantity_received,
          unit_cost_bs: item.unit_cost_bs,
          unit_cost_usd: item.unit_cost_usd,
          warehouse_id: transfer.from_warehouse_id,
          note: `Transferencia enviada #${transfer.transfer_number}`,
          ref: { transfer_id: transfer.id },
          happened_at: new Date(),
          approved: true,
          requested_by: userId,
          approved_by: userId,
          approved_at: new Date(),
        });
        await movementRepo.save(movementOut);

        // 6. Registrar Movimiento de Entrada (Transfer In) - Destino
        const movementIn = movementRepo.create({
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          movement_type: 'transfer_in',
          qty_delta: receivedDto.quantity_received,
          unit_cost_bs: item.unit_cost_bs,
          unit_cost_usd: item.unit_cost_usd,
          warehouse_id: transfer.to_warehouse_id,
          note: `Transferencia recibida #${transfer.transfer_number}`,
          ref: { transfer_id: transfer.id },
          happened_at: new Date(),
          approved: true,
          requested_by: userId,
          approved_by: userId,
          approved_at: new Date(),
        });
        await movementRepo.save(movementIn);
      }

      // Actualizar transferencia
      transfer.status = 'completed';
      transfer.received_by = userId;
      transfer.received_at = new Date();
      if (dto.note) {
        transfer.note = (transfer.note ? transfer.note + '\n' : '') + dto.note;
      }

      const savedTransfer = await manager.save(Transfer, transfer);

      // Generar asiento contable automático
      setImmediate(async () => {
        try {
          await this.accountingService.generateEntryFromTransfer(storeId, {
            id: savedTransfer.id,
            transfer_number: savedTransfer.transfer_number,
            received_at: savedTransfer.received_at,
            items: savedTransfer.items.map((item) => ({
              product_id: item.product_id,
              quantity_received: item.quantity_received || 0,
            })),
          });
        } catch (error) {
          this.logger.error(
            `Error generando asiento contable para transferencia ${savedTransfer.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });

      return savedTransfer;
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
          manager,
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
