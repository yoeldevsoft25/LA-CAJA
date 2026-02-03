import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Table } from '../database/entities/table.entity';
import { QRCode } from '../database/entities/qr-code.entity';
import { Product } from '../database/entities/product.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { randomUUID } from 'crypto';

export interface CreatePublicOrderDto {
  qr_code: string;
  items: Array<{
    product_id: string;
    qty: number;
    note?: string | null;
  }>;
}

/**
 * Servicio para crear órdenes desde el menú público (sin autenticación)
 */
@Injectable()
export class PublicOrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(QRCode)
    private qrCodeRepository: Repository<QRCode>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Crea una orden desde el menú público
   */
  async createOrderFromMenu(dto: CreatePublicOrderDto): Promise<Order> {
    // Validar código QR
    const qrCode = await this.qrCodeRepository.findOne({
      where: { qr_code: dto.qr_code },
      relations: ['table'],
    });

    if (!qrCode || !qrCode.is_active) {
      throw new BadRequestException('Código QR inválido o inactivo');
    }

    if (qrCode.expires_at && qrCode.expires_at < new Date()) {
      throw new BadRequestException('Código QR expirado');
    }

    const table = await this.tableRepository.findOne({
      where: { id: qrCode.table_id },
    });

    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }

    // Verificar que los productos existan y estén activos
    const productIds = dto.items.map((item) => item.product_id);
    const products = await this.productRepository.find({
      where: productIds.map((id) => ({ id, is_active: true })),
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no están disponibles');
    }

    // Crear orden
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const order = this.orderRepository.create({
      id: randomUUID(),
      store_id: table.store_id,
      table_id: table.id,
      order_number: orderNumber,
      status: 'open',
      opened_at: new Date(),
    });

    const savedOrder = await this.orderRepository.save(order);

    // Crear items de la orden
    const orderItems = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) {
        throw new BadRequestException(
          `Producto ${item.product_id} no encontrado`,
        );
      }

      return this.orderItemRepository.create({
        id: randomUUID(),
        order_id: savedOrder.id,
        product_id: item.product_id,
        qty: item.qty,
        unit_price_bs: product.price_bs,
        unit_price_usd: product.price_usd,
        discount_bs: 0,
        discount_usd: 0,
        note: item.note || null,
      });
    });

    await this.orderItemRepository.save(orderItems);

    // Actualizar mesa
    table.current_order_id = savedOrder.id;
    table.status = 'occupied';
    const updatedTable = await this.tableRepository.save(table);

    // Recargar orden con items
    const finalOrder = (await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'table'],
    })) as Order;

    // Emitir eventos WebSocket para notificar en tiempo real
    if (finalOrder) {
      this.notificationsGateway.emitOrderCreated(table.store_id, finalOrder);
      this.notificationsGateway.emitOrderUpdate(table.store_id, finalOrder);
      this.notificationsGateway.emitTableUpdate(table.store_id, updatedTable);
      this.notificationsGateway.emitKitchenUpdate(table.store_id, finalOrder);
    }

    return finalOrder;
  }

  /**
   * Obtiene la orden actual de una mesa por código QR
   */
  async getCurrentOrderByQR(qrCode: string): Promise<{
    order: Order | null;
    items: Array<{
      id: string;
      product_name: string;
      qty: number;
      status: 'pending' | 'preparing' | 'ready';
    }>;
  }> {
    // Validar código QR
    const qrCodeEntity = await this.qrCodeRepository.findOne({
      where: { qr_code: qrCode },
      relations: ['table'],
    });

    if (!qrCodeEntity || !qrCodeEntity.is_active) {
      throw new BadRequestException('Código QR inválido o inactivo');
    }

    if (qrCodeEntity.expires_at && qrCodeEntity.expires_at < new Date()) {
      throw new BadRequestException('Código QR expirado');
    }

    const table = await this.tableRepository.findOne({
      where: { id: qrCodeEntity.table_id },
    });

    if (!table || !table.current_order_id) {
      return {
        order: null,
        items: [],
      };
    }

    // Obtener la orden actual
    const order = await this.orderRepository.findOne({
      where: {
        id: table.current_order_id,
        store_id: table.store_id,
      },
      relations: ['items', 'items.product'],
    });

    if (!order || order.status !== 'open') {
      return {
        order: null,
        items: [],
      };
    }

    // Mapear items con estado real
    const items = order.items.map((item) => ({
      id: item.id,
      product_name: (item.product as any)?.name || 'Producto desconocido',
      qty: item.qty,
      status: (item.status || 'pending') as 'pending' | 'preparing' | 'ready',
    }));

    return {
      order,
      items,
    };
  }
}
