import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../database/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../database/entities/purchase-order-item.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Product } from '../database/entities/product.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de órdenes de compra
 */
@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    private inventoryService: InventoryService,
    private warehousesService: WarehousesService,
    private dataSource: DataSource,
  ) {}

  /**
   * Genera un número único de orden de compra
   */
  private async generateOrderNumber(storeId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.purchaseOrderRepository.count({
      where: { store_id: storeId },
    });
    return `OC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Crea una nueva orden de compra
   */
  async create(
    storeId: string,
    dto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    // Validar proveedor
    const supplier = await this.supplierRepository.findOne({
      where: { id: dto.supplier_id, store_id: storeId },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    if (!supplier.is_active) {
      throw new BadRequestException('El proveedor está inactivo');
    }

    // Validar bodega (si se proporciona)
    let warehouse: Warehouse | null = null;
    if (dto.warehouse_id) {
      warehouse = await this.warehouseRepository.findOne({
        where: { id: dto.warehouse_id, store_id: storeId },
      });

      if (!warehouse) {
        throw new NotFoundException('Bodega no encontrada');
      }
    } else {
      // Obtener bodega por defecto
      warehouse = await this.warehousesService.getDefault(storeId);
    }

    // Validar productos
    let totalAmountBs = 0;
    let totalAmountUsd = 0;

    for (const itemDto of dto.items) {
      const product = await this.productRepository.findOne({
        where: { id: itemDto.product_id, store_id: storeId },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto ${itemDto.product_id} no encontrado`,
        );
      }

      const itemTotalBs = itemDto.quantity * itemDto.unit_cost_bs;
      const itemTotalUsd = itemDto.quantity * itemDto.unit_cost_usd;
      totalAmountBs += itemTotalBs;
      totalAmountUsd += itemTotalUsd;
    }

    // Crear orden
    const orderNumber = await this.generateOrderNumber(storeId);
    const expectedDeliveryDate = dto.expected_delivery_date
      ? new Date(dto.expected_delivery_date)
      : null;

    const order = this.purchaseOrderRepository.create({
      id: randomUUID(),
      store_id: storeId,
      order_number: orderNumber,
      supplier_id: dto.supplier_id,
      warehouse_id: warehouse?.id || null,
      status: 'draft',
      expected_delivery_date: expectedDeliveryDate,
      requested_by: userId,
      requested_at: new Date(),
      total_amount_bs: totalAmountBs,
      total_amount_usd: totalAmountUsd,
      note: dto.note || null,
    });

    const savedOrder = await this.purchaseOrderRepository.save(order);

    // Crear items
    const items: PurchaseOrderItem[] = [];
    for (const itemDto of dto.items) {
      const item = this.purchaseOrderItemRepository.create({
        id: randomUUID(),
        purchase_order_id: savedOrder.id,
        product_id: itemDto.product_id,
        variant_id: itemDto.variant_id || null,
        quantity: itemDto.quantity,
        quantity_received: 0,
        unit_cost_bs: itemDto.unit_cost_bs,
        unit_cost_usd: itemDto.unit_cost_usd,
        total_cost_bs: itemDto.quantity * itemDto.unit_cost_bs,
        total_cost_usd: itemDto.quantity * itemDto.unit_cost_usd,
        note: itemDto.note || null,
      });

      const savedItem = await this.purchaseOrderItemRepository.save(item);
      items.push(savedItem);
    }

    savedOrder.items = items;
    return savedOrder;
  }

  /**
   * Marca una orden como enviada
   */
  async send(storeId: string, orderId: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id: orderId, store_id: storeId },
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status !== 'draft') {
      throw new BadRequestException(
        `Solo se pueden enviar órdenes en borrador. Estado actual: ${order.status}`,
      );
    }

    order.status = 'sent';
    order.sent_at = new Date();
    return this.purchaseOrderRepository.save(order);
  }

  /**
   * Marca una orden como confirmada
   */
  async confirm(storeId: string, orderId: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id: orderId, store_id: storeId },
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status !== 'sent') {
      throw new BadRequestException(
        `Solo se pueden confirmar órdenes enviadas. Estado actual: ${order.status}`,
      );
    }

    order.status = 'confirmed';
    order.confirmed_at = new Date();
    return this.purchaseOrderRepository.save(order);
  }

  /**
   * Recibe una orden de compra (parcial o completa)
   */
  async receive(
    storeId: string,
    orderId: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id: orderId, store_id: storeId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (!['sent', 'confirmed', 'partial'].includes(order.status)) {
      throw new BadRequestException(
        `No se puede recibir una orden con estado: ${order.status}`,
      );
    }

    // Validar cantidades recibidas
    if (dto.items.length !== order.items.length) {
      throw new BadRequestException(
        'La cantidad de items no coincide con la orden',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      let allReceived = true;
      let anyReceived = false;

      // Procesar items y actualizar inventario
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const receivedDto = dto.items[i];

        if (receivedDto.quantity_received > item.quantity) {
          throw new BadRequestException(
            `La cantidad recibida no puede ser mayor a la solicitada para el item ${i + 1}`,
          );
        }

        if (receivedDto.quantity_received < 0) {
          throw new BadRequestException(
            `La cantidad recibida no puede ser negativa para el item ${i + 1}`,
          );
        }

        // Actualizar cantidad recibida
        const previousReceived = item.quantity_received;
        item.quantity_received = receivedDto.quantity_received;
        await manager.save(PurchaseOrderItem, item);

        // Si se recibió algo nuevo, actualizar inventario
        if (receivedDto.quantity_received > previousReceived) {
          const qtyReceived = receivedDto.quantity_received - previousReceived;
          anyReceived = true;

          // Determinar bodega destino
          const warehouseId = order.warehouse_id;
          if (warehouseId) {
            // Actualizar stock en bodega específica
            await this.warehousesService.updateStock(
              warehouseId,
              item.product_id,
              item.variant_id,
              qtyReceived,
            );
          }

          // Crear movimiento de inventario
          await this.inventoryService.stockReceived(
            storeId,
            {
              product_id: item.product_id,
              qty: qtyReceived,
              unit_cost_bs: item.unit_cost_bs,
              unit_cost_usd: item.unit_cost_usd,
              note: `Recepción de orden ${order.order_number}`,
              ref: {
                purchase_order_id: order.id,
                supplier_id: order.supplier_id,
                warehouse_id: warehouseId,
              },
            },
            userId,
            'owner', // Recepción siempre aprobada
          );
        }

        // Verificar si todos los items están completos
        if (item.quantity_received < item.quantity) {
          allReceived = false;
        }
      }

      // Actualizar estado de la orden
      if (allReceived) {
        order.status = 'completed';
        order.received_at = new Date();
        order.received_by = userId;
      } else if (anyReceived) {
        order.status = 'partial';
        if (!order.received_at) {
          order.received_at = new Date();
          order.received_by = userId;
        }
      }

      if (dto.note) {
        order.note = (order.note ? order.note + '\n' : '') + dto.note;
      }

      return manager.save(PurchaseOrder, order);
    });
  }

  /**
   * Cancela una orden de compra
   */
  async cancel(storeId: string, orderId: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id: orderId, store_id: storeId },
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status === 'completed') {
      throw new BadRequestException(
        'No se puede cancelar una orden completada',
      );
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException('La orden ya está cancelada');
    }

    order.status = 'cancelled';
    return this.purchaseOrderRepository.save(order);
  }

  /**
   * Obtiene todas las órdenes de compra de una tienda
   */
  async findAll(
    storeId: string,
    status?: PurchaseOrderStatus,
    supplierId?: string,
  ): Promise<PurchaseOrder[]> {
    const where: any = { store_id: storeId };
    if (status) {
      where.status = status;
    }
    if (supplierId) {
      where.supplier_id = supplierId;
    }

    return this.purchaseOrderRepository.find({
      where,
      relations: ['items', 'supplier', 'warehouse'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene una orden de compra por ID
   */
  async findOne(storeId: string, orderId: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id: orderId, store_id: storeId },
      relations: ['items', 'supplier', 'warehouse', 'requester', 'receiver'],
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    return order;
  }
}
