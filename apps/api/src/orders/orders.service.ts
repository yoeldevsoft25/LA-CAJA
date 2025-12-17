import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { OrderPayment } from '../database/entities/order-payment.entity';
import { Table } from '../database/entities/table.entity';
import { Product } from '../database/entities/product.entity';
import { ProductVariant } from '../database/entities/product-variant.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CreatePartialPaymentDto } from './dto/create-partial-payment.dto';
import { MoveOrderDto } from './dto/move-order.dto';
import { MergeOrdersDto } from './dto/merge-orders.dto';
import { TablesService } from '../tables/tables.service';
import { SalesService } from '../sales/sales.service';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de órdenes (cuentas abiertas)
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderPayment)
    private orderPaymentRepository: Repository<OrderPayment>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private tablesService: TablesService,
    private salesService: SalesService,
  ) {}

  /**
   * Genera un número de orden único
   */
  private async generateOrderNumber(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Contar órdenes del día
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.orderRepository.count({
      where: {
        store_id: storeId,
        opened_at: Between(startOfDay, endOfDay),
      },
    });

    const orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    return orderNumber;
  }

  /**
   * Crea una nueva orden
   */
  async createOrder(
    storeId: string,
    dto: CreateOrderDto,
    userId?: string,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Verificar mesa si se proporciona
      let table: Table | null = null;
      if (dto.table_id) {
        table = await manager.findOne(Table, {
          where: { id: dto.table_id, store_id: storeId },
        });

        if (!table) {
          throw new NotFoundException('Mesa no encontrada');
        }

        // Verificar que la mesa no tenga una orden activa
        if (table.current_order_id) {
          throw new BadRequestException('La mesa ya tiene una orden activa');
        }
      }

      // Generar número de orden
      const orderNumber = await this.generateOrderNumber(storeId);

      // Crear orden
      const order = manager.create(Order, {
        id: randomUUID(),
        store_id: storeId,
        table_id: dto.table_id || null,
        order_number: orderNumber,
        status: 'open',
        customer_id: dto.customer_id || null,
        opened_by_user_id: userId || null,
        note: dto.note || null,
      });

      const savedOrder = await manager.save(Order, order);

      // Actualizar mesa si aplica
      if (table) {
        table.current_order_id = savedOrder.id;
        table.status = 'occupied';
        table.updated_at = new Date();
        await manager.save(Table, table);
      }

      // Agregar items iniciales si se proporcionan
      if (dto.items && dto.items.length > 0) {
        const items = await this.createOrderItems(
          storeId,
          savedOrder.id,
          dto.items,
          manager,
        );
        savedOrder.items = items;
      }

      return savedOrder;
    });
  }

  /**
   * Crea items de orden
   */
  private async createOrderItems(
    storeId: string,
    orderId: string,
    items: AddOrderItemDto[],
    manager: any,
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];

    for (const itemDto of items) {
      // Verificar producto
      const product = await manager.findOne(Product, {
        where: { id: itemDto.product_id, store_id: storeId },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto ${itemDto.product_id} no encontrado`,
        );
      }

      // Verificar variante si aplica
      if (itemDto.variant_id) {
        const variant = await manager.findOne(ProductVariant, {
          where: { id: itemDto.variant_id, product_id: itemDto.product_id },
        });

        if (!variant) {
          throw new NotFoundException('Variante no encontrada');
        }
      }

      // Obtener precios (usar variante si aplica)
      let unitPriceBs = product.price_bs;
      let unitPriceUsd = product.price_usd;

      if (itemDto.variant_id) {
        const variant = await manager.findOne(ProductVariant, {
          where: { id: itemDto.variant_id },
        });
        if (variant) {
          unitPriceBs = variant.price_bs;
          unitPriceUsd = variant.price_usd;
        }
      }

      const orderItem = manager.create(OrderItem, {
        id: randomUUID(),
        order_id: orderId,
        product_id: itemDto.product_id,
        variant_id: itemDto.variant_id || null,
        qty: itemDto.qty,
        unit_price_bs: unitPriceBs,
        unit_price_usd: unitPriceUsd,
        discount_bs: itemDto.discount_bs || 0,
        discount_usd: itemDto.discount_usd || 0,
        note: itemDto.note || null,
      });

      const savedItem = await manager.save(OrderItem, orderItem);
      orderItems.push(savedItem);
    }

    return orderItems;
  }

  /**
   * Obtiene una orden por ID
   */
  async getOrderById(storeId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, store_id: storeId },
      relations: [
        'table',
        'customer',
        'items',
        'items.product',
        'items.variant',
        'payments',
      ],
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return order;
  }

  /**
   * Obtiene todas las órdenes abiertas de una tienda
   */
  async getOpenOrders(storeId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { store_id: storeId, status: 'open' },
      relations: ['table', 'customer', 'items', 'items.product'],
      order: { opened_at: 'DESC' },
    });
  }

  /**
   * Agrega un item a una orden
   */
  async addOrderItem(
    storeId: string,
    orderId: string,
    dto: AddOrderItemDto,
  ): Promise<OrderItem> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'open') {
      throw new BadRequestException(
        `Solo se pueden agregar items a órdenes abiertas. Estado actual: ${order.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const items = await this.createOrderItems(
        storeId,
        orderId,
        [dto],
        manager,
      );
      return items[0];
    });
  }

  /**
   * Elimina un item de una orden
   */
  async removeOrderItem(
    storeId: string,
    orderId: string,
    itemId: string,
  ): Promise<void> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'open') {
      throw new BadRequestException(
        `Solo se pueden eliminar items de órdenes abiertas. Estado actual: ${order.status}`,
      );
    }

    const item = await this.orderItemRepository.findOne({
      where: { id: itemId, order_id: orderId },
    });

    if (!item) {
      throw new NotFoundException('Item de orden no encontrado');
    }

    await this.orderItemRepository.remove(item);
  }

  /**
   * Pausa una orden
   */
  async pauseOrder(storeId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'open') {
      throw new BadRequestException(
        `Solo se pueden pausar órdenes abiertas. Estado actual: ${order.status}`,
      );
    }

    order.status = 'paused';
    order.paused_at = new Date();
    order.updated_at = new Date();

    return this.orderRepository.save(order);
  }

  /**
   * Reanuda una orden pausada
   */
  async resumeOrder(storeId: string, orderId: string): Promise<Order> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'paused') {
      throw new BadRequestException(
        `Solo se pueden reanudar órdenes pausadas. Estado actual: ${order.status}`,
      );
    }

    order.status = 'open';
    order.paused_at = null;
    order.updated_at = new Date();

    return this.orderRepository.save(order);
  }

  /**
   * Mueve una orden a otra mesa
   */
  async moveOrder(
    storeId: string,
    orderId: string,
    dto: MoveOrderDto,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, store_id: storeId },
        relations: ['table'],
      });

      if (!order) {
        throw new NotFoundException('Orden no encontrada');
      }

      if (order.status !== 'open') {
        throw new BadRequestException(
          `Solo se pueden mover órdenes abiertas. Estado actual: ${order.status}`,
        );
      }

      // Liberar mesa actual si existe
      if (order.table_id) {
        const currentTable = await manager.findOne(Table, {
          where: { id: order.table_id },
        });
        if (currentTable) {
          currentTable.current_order_id = null;
          currentTable.status = 'available';
          currentTable.updated_at = new Date();
          await manager.save(Table, currentTable);
        }
      }

      // Asignar nueva mesa si se proporciona
      if (dto.table_id) {
        const newTable = await manager.findOne(Table, {
          where: { id: dto.table_id, store_id: storeId },
        });

        if (!newTable) {
          throw new NotFoundException('Mesa no encontrada');
        }

        if (newTable.current_order_id) {
          throw new BadRequestException('La mesa ya tiene una orden activa');
        }

        newTable.current_order_id = orderId;
        newTable.status = 'occupied';
        newTable.updated_at = new Date();
        await manager.save(Table, newTable);
      }

      order.table_id = dto.table_id || null;
      order.updated_at = new Date();

      return manager.save(Order, order);
    });
  }

  /**
   * Fusiona múltiples órdenes en una
   */
  async mergeOrders(storeId: string, dto: MergeOrdersDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Verificar que todas las órdenes existan y pertenezcan a la tienda
      const orders = await manager.find(Order, {
        where: {
          id: In(dto.order_ids),
          store_id: storeId,
        },
        relations: ['items'],
      });

      if (orders.length !== dto.order_ids.length) {
        throw new NotFoundException('Una o más órdenes no encontradas');
      }

      // Verificar que todas estén abiertas
      const nonOpenOrders = orders.filter((o) => o.status !== 'open');
      if (nonOpenOrders.length > 0) {
        throw new BadRequestException(
          'Solo se pueden fusionar órdenes abiertas',
        );
      }

      // Obtener orden destino
      const targetOrder = orders.find((o) => o.id === dto.target_order_id);
      if (!targetOrder) {
        throw new NotFoundException('Orden destino no encontrada');
      }

      // Mover items de otras órdenes a la orden destino
      for (const order of orders) {
        if (order.id === dto.target_order_id) continue;

        for (const item of order.items) {
          item.order_id = dto.target_order_id;
          await manager.save(OrderItem, item);
        }

        // Cancelar orden fusionada
        order.status = 'cancelled';
        order.closed_at = new Date();
        await manager.save(Order, order);

        // Liberar mesa si tiene
        if (order.table_id) {
          const table = await manager.findOne(Table, {
            where: { id: order.table_id },
          });
          if (table) {
            table.current_order_id = null;
            table.status = 'available';
            table.updated_at = new Date();
            await manager.save(Table, table);
          }
        }
      }

      // Recargar orden destino con items actualizados
      const updatedOrder = await manager.findOne(Order, {
        where: { id: dto.target_order_id },
        relations: ['items', 'items.product'],
      });

      if (!updatedOrder) {
        throw new NotFoundException(
          'Orden destino no encontrada después de la fusión',
        );
      }

      return updatedOrder;
    });
  }

  /**
   * Calcula el total de una orden
   */
  async calculateOrderTotal(order: Order): Promise<{
    subtotal_bs: number;
    subtotal_usd: number;
    discount_bs: number;
    discount_usd: number;
    total_bs: number;
    total_usd: number;
  }> {
    let subtotalBs = 0;
    let subtotalUsd = 0;
    let discountBs = 0;
    let discountUsd = 0;

    for (const item of order.items) {
      const itemSubtotalBs = item.unit_price_bs * item.qty;
      const itemSubtotalUsd = item.unit_price_usd * item.qty;

      subtotalBs += itemSubtotalBs;
      subtotalUsd += itemSubtotalUsd;
      discountBs += item.discount_bs;
      discountUsd += item.discount_usd;
    }

    return {
      subtotal_bs: subtotalBs,
      subtotal_usd: subtotalUsd,
      discount_bs: discountBs,
      discount_usd: discountUsd,
      total_bs: subtotalBs - discountBs,
      total_usd: subtotalUsd - discountUsd,
    };
  }

  /**
   * Crea un pago parcial (recibo parcial)
   */
  async createPartialPayment(
    storeId: string,
    orderId: string,
    dto: CreatePartialPaymentDto,
    userId?: string,
  ): Promise<{ payment: OrderPayment; sale: any }> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'open') {
      throw new BadRequestException(
        `Solo se pueden realizar pagos parciales en órdenes abiertas. Estado actual: ${order.status}`,
      );
    }

    // Calcular total de la orden
    const totals = await this.calculateOrderTotal(order);

    // Calcular total pagado hasta ahora
    const totalPaidBs = order.payments.reduce((sum, p) => sum + p.amount_bs, 0);
    const totalPaidUsd = order.payments.reduce(
      (sum, p) => sum + p.amount_usd,
      0,
    );

    // Verificar que el pago no exceda el total pendiente
    const remainingBs = totals.total_bs - totalPaidBs;
    const remainingUsd = totals.total_usd - totalPaidUsd;

    if (dto.amount_bs > remainingBs || dto.amount_usd > remainingUsd) {
      throw new BadRequestException(
        'El monto del pago parcial excede el total pendiente',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Crear pago parcial
      const payment = manager.create(OrderPayment, {
        id: randomUUID(),
        order_id: orderId,
        amount_bs: dto.amount_bs,
        amount_usd: dto.amount_usd,
        payment_method: dto.payment_method,
        paid_by_user_id: userId || null,
        note: dto.note || null,
      });

      const savedPayment = await manager.save(OrderPayment, payment);

      // Generar venta para el pago parcial
      // Nota: Esto requiere crear una venta parcial, lo cual es complejo
      // Por ahora, solo guardamos el pago y la venta se genera al cerrar la orden
      // TODO: Implementar generación de venta parcial si es necesario

      return { payment: savedPayment, sale: null };
    });
  }

  /**
   * Cierra una orden completa (genera venta final)
   */
  async closeOrder(
    storeId: string,
    orderId: string,
    dto: CreateSaleDto,
    userId?: string,
  ): Promise<{ order: Order; sale: any }> {
    const order = await this.getOrderById(storeId, orderId);

    if (order.status !== 'open') {
      throw new BadRequestException(
        `Solo se pueden cerrar órdenes abiertas. Estado actual: ${order.status}`,
      );
    }

    // Verificar que la orden tenga items
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('La orden no tiene items');
    }

    return this.dataSource.transaction(async (manager) => {
      // Convertir items de orden a items de venta
      const saleItems = order.items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        discount_bs: item.discount_bs,
        discount_usd: item.discount_usd,
      }));

      // Crear venta usando el SalesService
      // Nota: Esto requiere acceso al SalesService, que ya está inyectado
      const saleDto: CreateSaleDto = {
        ...dto,
        items: saleItems,
        customer_id: order.customer_id || dto.customer_id,
      };

      const sale = await this.salesService.create(storeId, saleDto, userId);

      // Cerrar orden
      order.status = 'closed';
      order.closed_at = new Date();
      order.closed_by_user_id = userId || null;
      order.updated_at = new Date();

      const savedOrder = await manager.save(Order, order);

      // Liberar mesa si tiene
      if (order.table_id) {
        const table = await manager.findOne(Table, {
          where: { id: order.table_id },
        });
        if (table) {
          table.current_order_id = null;
          table.status = 'available';
          table.updated_at = new Date();
          await manager.save(Table, table);
        }
      }

      return { order: savedOrder, sale };
    });
  }

  /**
   * Cancela una orden
   */
  async cancelOrder(storeId: string, orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, store_id: storeId },
        relations: ['table'],
      });

      if (!order) {
        throw new NotFoundException('Orden no encontrada');
      }

      if (order.status === 'closed') {
        throw new BadRequestException('No se puede cancelar una orden cerrada');
      }

      order.status = 'cancelled';
      order.closed_at = new Date();
      order.updated_at = new Date();

      const savedOrder = await manager.save(Order, order);

      // Liberar mesa si tiene
      if (order.table_id) {
        const table = await manager.findOne(Table, {
          where: { id: order.table_id },
        });
        if (table) {
          table.current_order_id = null;
          table.status = 'available';
          table.updated_at = new Date();
          await manager.save(Table, table);
        }
      }

      return savedOrder;
    });
  }
}
