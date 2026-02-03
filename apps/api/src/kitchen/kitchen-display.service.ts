import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Table } from '../database/entities/table.entity';
import { Product } from '../database/entities/product.entity';
import { Store } from '../database/entities/store.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { RecipesService } from '../recipes/recipes.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

export interface KitchenOrderItem {
  id: string;
  product_name: string;
  qty: number;
  note: string | null;
  status: 'pending' | 'preparing' | 'ready';
  added_at: string;
}

export interface KitchenOrder {
  id: string;
  order_number: string;
  table_number: string;
  table_name: string | null;
  items: KitchenOrderItem[];
  created_at: string;
  elapsed_time: number; // minutos desde que se creó
}

/**
 * Servicio para Kitchen Display System (KDS)
 */
@Injectable()
export class KitchenDisplayService {
  private readonly logger = new Logger(KitchenDisplayService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    private recipesService: RecipesService,
    private configService: ConfigService,
  ) {}

  private generatePublicUrl(token: string): string {
    let baseUrl = this.configService.get<string>('FRONTEND_URL');

    if (!baseUrl) {
      baseUrl = 'http://la-caja.netlify.app';
    }

    return `${baseUrl}/public/kitchen/${token}`;
  }

  async getOrCreatePublicLink(
    storeId: string,
  ): Promise<{ token: string; url: string; has_pin: boolean }> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    if (!store.kitchen_public_token) {
      store.kitchen_public_token = randomUUID().replace(/-/g, '');
      await this.storeRepository.save(store);
    }

    return {
      token: store.kitchen_public_token,
      url: this.generatePublicUrl(store.kitchen_public_token),
      has_pin: !!store.kitchen_public_pin_hash,
    };
  }

  async rotatePublicToken(
    storeId: string,
  ): Promise<{ token: string; url: string; has_pin: boolean }> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    store.kitchen_public_token = randomUUID().replace(/-/g, '');
    await this.storeRepository.save(store);

    return {
      token: store.kitchen_public_token,
      url: this.generatePublicUrl(store.kitchen_public_token),
      has_pin: !!store.kitchen_public_pin_hash,
    };
  }

  async getPublicKitchenOrders(
    token: string,
    pin?: string,
  ): Promise<KitchenOrder[]> {
    const store = await this.storeRepository.findOne({
      where: { kitchen_public_token: token },
      select: ['id', 'kitchen_public_pin_hash'],
    });

    if (!store) {
      throw new NotFoundException('Token de cocina inválido');
    }

    if (store.kitchen_public_pin_hash) {
      if (!pin) {
        throw new BadRequestException('PIN requerido');
      }
      const isValid = await bcrypt.compare(pin, store.kitchen_public_pin_hash);
      if (!isValid) {
        throw new BadRequestException('PIN inválido');
      }
    }

    return this.getKitchenOrders(store.id);
  }

  async setPublicPin(
    storeId: string,
    pin?: string,
  ): Promise<{ has_pin: boolean }> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    if (!pin) {
      store.kitchen_public_pin_hash = null;
      await this.storeRepository.save(store);
      return { has_pin: false };
    }

    store.kitchen_public_pin_hash = await bcrypt.hash(pin, 10);
    await this.storeRepository.save(store);
    return { has_pin: true };
  }

  /**
   * Obtiene todas las órdenes abiertas para la cocina
   */
  async getKitchenOrders(storeId: string): Promise<KitchenOrder[]> {
    const orders = await this.orderRepository.find({
      where: {
        store_id: storeId,
        status: 'open',
      },
      relations: ['table', 'items', 'items.product'],
      order: {
        opened_at: 'ASC',
      },
    });

    return orders.map((order) => {
      const elapsedMinutes = Math.floor(
        (Date.now() - new Date(order.opened_at).getTime()) / 60000,
      );

      return {
        id: order.id,
        order_number: order.order_number,
        table_number: order.table?.table_number || 'Sin mesa',
        table_name: order.table?.name || null,
        items: order.items.map((item) => ({
          id: item.id,
          product_name: (item.product as any)?.name || 'Producto desconocido',
          qty: item.qty,
          note: item.note,
          status: (item.status || 'pending') as
            | 'pending'
            | 'preparing'
            | 'ready',
          added_at: item.added_at.toISOString(),
        })),
        created_at: order.opened_at.toISOString(),
        elapsed_time: elapsedMinutes,
      };
    });
  }

  /**
   * Obtiene una orden específica para la cocina
   */
  async getKitchenOrder(
    storeId: string,
    orderId: string,
  ): Promise<KitchenOrder | null> {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        store_id: storeId,
        status: 'open',
      },
      relations: ['table', 'items', 'items.product'],
    });

    if (!order) return null;

    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(order.opened_at).getTime()) / 60000,
    );

    return {
      id: order.id,
      order_number: order.order_number,
      table_number: order.table?.table_number || 'Sin mesa',
      table_name: order.table?.name || null,
      items: order.items.map((item) => ({
        id: item.id,
        product_name: (item.product as any)?.name || 'Producto desconocido',
        qty: item.qty,
        note: item.note,
        status: 'pending' as const,
        added_at: item.added_at.toISOString(),
      })),
      created_at: order.opened_at.toISOString(),
      elapsed_time: elapsedMinutes,
    };
  }

  /**
   * Actualiza el estado de un item de orden
   */
  async updateOrderItemStatus(
    storeId: string,
    orderId: string,
    itemId: string,
    status: 'pending' | 'preparing' | 'ready',
  ): Promise<OrderItem> {
    // Verificar que la orden existe y pertenece al store
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        store_id: storeId,
        status: 'open',
      },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada o no está abierta');
    }

    // Verificar que el item existe y pertenece a la orden
    const item = await this.orderItemRepository.findOne({
      where: {
        id: itemId,
        order_id: orderId,
      },
    });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    // Validar transición de estado
    if (status === 'pending' && item.status === 'ready') {
      throw new BadRequestException(
        'No se puede revertir un item listo a pendiente',
      );
    }

    // Si el item pasa a 'ready', descontar stock de ingredientes (receta)
    if (status === 'ready' && item.status !== 'ready') {
      try {
        await this.recipesService.consumeIngredients(
          storeId,
          item.product_id,
          item.qty,
        );
      } catch (error) {
        this.logger.error(
          `Error consumiendo ingredientes para el plato ${item.product_id}: ${error.message}`,
          error.stack,
        );
        // No bloqueamos el cambio de estado si falla el inventario
      }
    }

    // Actualizar estado
    item.status = status;
    const updatedItem = await this.orderItemRepository.save(item);

    // Recargar orden completa para emitir actualización
    const updatedOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'table'],
    });

    if (updatedOrder) {
      // Emitir eventos WebSocket
      this.notificationsGateway.emitOrderUpdate(storeId, updatedOrder);
      this.notificationsGateway.emitKitchenUpdate(storeId, updatedOrder);
    }

    return updatedItem;
  }
}
