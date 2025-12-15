import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Customer } from '../database/entities/customer.entity';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { randomUUID } from 'crypto';
import { CashSession } from '../database/entities/cash-session.entity';
import { IsNull } from 'typeorm';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(DebtPayment)
    private debtPaymentRepository: Repository<DebtPayment>,
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    private dataSource: DataSource,
  ) {}

  async create(storeId: string, dto: CreateSaleDto, userId?: string): Promise<Sale> {
    // Validar que hay items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito no puede estar vacío');
    }

    // Validar que exista una sesión de caja abierta
    const openSession = await this.cashSessionRepository.findOne({
      where: { store_id: storeId, closed_at: IsNull() },
    });

    if (!openSession) {
      throw new BadRequestException('No hay una sesión de caja abierta. Abre caja para registrar ventas.');
    }

    // Si se envía cash_session_id debe coincidir con la sesión abierta
    if (dto.cash_session_id && dto.cash_session_id !== openSession.id) {
      throw new BadRequestException('La venta debe asociarse a la sesión de caja abierta actual.');
    }

    // Forzar asociación a la sesión abierta (incluye casos en los que no se envió cash_session_id)
    dto.cash_session_id = openSession.id;

    // Usar transacción para asegurar consistencia (incluye creación/actualización de cliente)
    return this.dataSource.transaction(async (manager) => {
      // Manejar información del cliente (opcional para todas las ventas)
      let finalCustomerId: string | null = null;
      
      // Si se proporciona customer_id, usarlo directamente
      if (dto.customer_id) {
        const existingCustomer = await manager.findOne(Customer, {
          where: { id: dto.customer_id, store_id: storeId },
        });
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
          // Opcionalmente actualizar datos si se proporcionan
          if (dto.customer_name || dto.customer_phone !== undefined || dto.customer_note !== undefined) {
            if (dto.customer_name) existingCustomer.name = dto.customer_name;
            if (dto.customer_phone !== undefined) existingCustomer.phone = dto.customer_phone || null;
            if (dto.customer_note !== undefined) existingCustomer.note = dto.customer_note || null;
            existingCustomer.updated_at = new Date();
            await manager.save(Customer, existingCustomer);
          }
        }
      }
      // Si se proporcionan datos de cliente (nombre, cédula, etc.) y NO hay customer_id
      else if (dto.customer_name || dto.customer_document_id || dto.customer_phone) {
        // Si hay nombre, la cédula es obligatoria
        if (dto.customer_name && !dto.customer_document_id) {
          throw new BadRequestException('Si proporcionas el nombre del cliente, la cédula es obligatoria');
        }

        // Si hay cédula, buscar cliente existente
        let customer: Customer | null = null;
        if (dto.customer_document_id) {
          customer = await manager.findOne(Customer, {
            where: { 
              store_id: storeId,
              document_id: dto.customer_document_id.trim(),
            },
          });
        }

        // Si existe, actualizarlo
        if (customer) {
          // Actualizar datos del cliente
          if (dto.customer_name) customer.name = dto.customer_name;
          if (dto.customer_phone !== undefined) customer.phone = dto.customer_phone || null;
          if (dto.customer_note !== undefined) customer.note = dto.customer_note || null;
          customer.updated_at = new Date();
          customer = await manager.save(Customer, customer);
          finalCustomerId = customer.id;
        } else if (dto.customer_name && dto.customer_document_id) {
          // Crear nuevo cliente (requiere nombre Y cédula)
          customer = manager.create(Customer, {
            id: randomUUID(),
            store_id: storeId,
            name: dto.customer_name,
            document_id: dto.customer_document_id.trim(),
            phone: dto.customer_phone || null,
            note: dto.customer_note || null,
            updated_at: new Date(),
          });
          customer = await manager.save(Customer, customer);
          finalCustomerId = customer.id;
        }
      } else if (dto.payment_method === 'FIAO') {
        // Para FIAO sin datos nuevos, buscar por customer_id existente
        if (dto.customer_id) {
          finalCustomerId = dto.customer_id;
        } else {
          throw new BadRequestException('FIAO requiere información del cliente (nombre y cédula) o un customer_id existente');
        }
      }
      const saleId = randomUUID();
      const soldAt = new Date();

      // Obtener productos y calcular totales
      const productMap = new Map<string, Product>();
      const items: SaleItem[] = [];
      let subtotalBs = 0;
      let subtotalUsd = 0;
      let discountBs = 0;
      let discountUsd = 0;

      // Procesar cada item del carrito
      for (const cartItem of dto.items) {
        const product = await manager.findOne(Product, {
          where: { id: cartItem.product_id, store_id: storeId, is_active: true },
        });

        if (!product) {
          throw new NotFoundException(`Producto ${cartItem.product_id} no encontrado o inactivo`);
        }

        productMap.set(product.id, product);

        // Verificar stock disponible
        const currentStock = await this.getCurrentStock(storeId, product.id);
        if (currentStock < cartItem.qty) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${currentStock}, Solicitado: ${cartItem.qty}`,
          );
        }

        // Calcular precios
        const itemDiscountBs = cartItem.discount_bs || 0;
        const itemDiscountUsd = cartItem.discount_usd || 0;
        const itemSubtotalBs = product.price_bs * cartItem.qty - itemDiscountBs;
        const itemSubtotalUsd = product.price_usd * cartItem.qty - itemDiscountUsd;

        subtotalBs += itemSubtotalBs;
        subtotalUsd += itemSubtotalUsd;
        discountBs += itemDiscountBs;
        discountUsd += itemDiscountUsd;

        // Crear sale item
        const saleItem = manager.create(SaleItem, {
          id: randomUUID(),
          sale_id: saleId,
          product_id: product.id,
          qty: cartItem.qty,
          unit_price_bs: product.price_bs,
          unit_price_usd: product.price_usd,
          discount_bs: itemDiscountBs,
          discount_usd: itemDiscountUsd,
        });

        items.push(saleItem);
      }

      // Calcular totales
      const totalBs = subtotalBs;
      const totalUsd = subtotalUsd;

      // Crear la venta
      const sale = manager.create(Sale, {
        id: saleId,
        store_id: storeId,
        cash_session_id: dto.cash_session_id || null,
        sold_at: soldAt,
        exchange_rate: dto.exchange_rate,
        currency: dto.currency,
        totals: {
          subtotal_bs: subtotalBs,
          subtotal_usd: subtotalUsd,
          discount_bs: discountBs,
          discount_usd: discountUsd,
          total_bs: totalBs,
          total_usd: totalUsd,
        },
        payment: {
          method: dto.payment_method,
          split: dto.split || undefined,
          cash_payment: dto.cash_payment || undefined,
          cash_payment_bs: dto.cash_payment_bs || undefined,
        },
        customer_id: finalCustomerId,
        sold_by_user_id: userId || null,
        note: dto.note || null,
      });

      const savedSale = await manager.save(Sale, sale);

      // Guardar items
      await manager.save(SaleItem, items);

      // Crear movimientos de inventario (descontar stock)
      for (const item of items) {
        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          movement_type: 'sold',
          qty_delta: -item.qty, // Negativo para descontar
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          note: `Venta ${saleId}`,
          ref: { sale_id: saleId },
          happened_at: soldAt,
        });

        await manager.save(InventoryMovement, movement);
      }

      // Si es venta FIAO, crear la deuda automáticamente
      if (dto.payment_method === 'FIAO' && finalCustomerId) {
        const debt = manager.create(Debt, {
          id: randomUUID(),
          store_id: storeId,
          sale_id: saleId,
          customer_id: finalCustomerId,
          created_at: soldAt,
          amount_bs: totalBs,
          amount_usd: totalUsd,
          status: DebtStatus.OPEN,
        });
        await manager.save(Debt, debt);
      }

      // Retornar la venta con items, cliente, responsable y deuda (si existe)
      const savedSaleWithItems = await manager
        .createQueryBuilder(Sale, 'sale')
        .leftJoinAndSelect('sale.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('sale.sold_by_user', 'sold_by_user')
        .leftJoinAndSelect('sale.customer', 'customer')
        .leftJoin('debts', 'debt', 'debt.sale_id = sale.id')
        .addSelect([
          'debt.id',
          'debt.status',
          'debt.amount_bs',
          'debt.amount_usd',
        ])
        .where('sale.id = :saleId', { saleId })
        .getOne();

      if (!savedSaleWithItems) {
        throw new Error('Error al recuperar la venta creada');
      }

      // Agregar información de deuda al objeto de venta
      const saleWithDebt = savedSaleWithItems as any;
      if (saleWithDebt.debt) {
        // Calcular monto pagado si hay pagos
        const debtWithPayments = await manager.findOne(Debt, {
          where: { id: saleWithDebt.debt.id },
          relations: ['payments'],
        });
        if (debtWithPayments) {
          const totalPaidBs = (debtWithPayments.payments || []).reduce(
            (sum: number, p: any) => sum + Number(p.amount_bs),
            0,
          );
          const totalPaidUsd = (debtWithPayments.payments || []).reduce(
            (sum: number, p: any) => sum + Number(p.amount_usd),
            0,
          );
          saleWithDebt.debt.total_paid_bs = totalPaidBs;
          saleWithDebt.debt.total_paid_usd = totalPaidUsd;
          saleWithDebt.debt.remaining_bs = Number(debtWithPayments.amount_bs) - totalPaidBs;
          saleWithDebt.debt.remaining_usd = Number(debtWithPayments.amount_usd) - totalPaidUsd;
        }
      }

      return saleWithDebt;
    });
  }

  async findOne(storeId: string, saleId: string): Promise<Sale> {
    const sale = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('sale.sold_by_user', 'sold_by_user')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoin('debts', 'debt', 'debt.sale_id = sale.id')
      .addSelect([
        'debt.id',
        'debt.status',
        'debt.amount_bs',
        'debt.amount_usd',
      ])
      .where('sale.id = :saleId', { saleId })
      .andWhere('sale.store_id = :storeId', { storeId })
      .getOne();

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Agregar información de pagos si hay deuda (optimizado)
    const saleWithDebt = sale as any;
    if (saleWithDebt.debt) {
      // Obtener pagos directamente sin cargar toda la relación
      const payments = await this.debtPaymentRepository.find({
        where: { debt_id: saleWithDebt.debt.id },
        select: ['amount_bs', 'amount_usd'],
      });
      
      const totalPaidBs = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount_bs || 0),
        0,
      );
      const totalPaidUsd = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount_usd || 0),
        0,
      );
      saleWithDebt.debt.total_paid_bs = totalPaidBs;
      saleWithDebt.debt.total_paid_usd = totalPaidUsd;
      saleWithDebt.debt.remaining_bs = Number(saleWithDebt.debt.amount_bs || 0) - totalPaidBs;
      saleWithDebt.debt.remaining_usd = Number(saleWithDebt.debt.amount_usd || 0) - totalPaidUsd;
    }

    return saleWithDebt;
  }

  async findAll(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{ sales: Sale[]; total: number }> {
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .orderBy('sale.sold_at', 'DESC');

    if (dateFrom) {
      query.andWhere('sale.sold_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('sale.sold_at <= :dateTo', { dateTo });
    }

    const total = await query.getCount();

    query.limit(limit).offset(offset);

    const sales = await query
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('sale.sold_by_user', 'sold_by_user')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoin('debts', 'debt', 'debt.sale_id = sale.id')
      .addSelect([
        'debt.id',
        'debt.status',
        'debt.amount_bs',
        'debt.amount_usd',
      ])
      .getMany();

    // Optimización: Obtener todas las deudas con sus pagos en una sola query (evita N+1)
    const debtIds = sales
      .map((sale) => (sale as any).debt?.id)
      .filter((id): id is string => Boolean(id));

    let debtPaymentsMap = new Map<string, any[]>();
    if (debtIds.length > 0) {
      // Obtener todos los pagos de todas las deudas en una sola query
      const allPayments = await this.debtPaymentRepository.find({
        where: { debt_id: In(debtIds) },
        select: ['id', 'debt_id', 'amount_bs', 'amount_usd'],
      });

      // Agrupar pagos por debt_id
      debtPaymentsMap = allPayments.reduce((map, payment) => {
        const debtId = payment.debt_id;
        if (!map.has(debtId)) {
          map.set(debtId, []);
        }
        map.get(debtId)!.push(payment);
        return map;
      }, new Map<string, any[]>());
    }

    // Enriquecer ventas con información de pagos (sin queries adicionales)
    const salesWithDebtInfo = sales.map((sale) => {
      const saleWithDebt = sale as any;
      if (saleWithDebt.debt) {
        const payments = debtPaymentsMap.get(saleWithDebt.debt.id) || [];
        const totalPaidBs = payments.reduce(
          (sum: number, p: any) => sum + Number(p.amount_bs || 0),
          0,
        );
        const totalPaidUsd = payments.reduce(
          (sum: number, p: any) => sum + Number(p.amount_usd || 0),
          0,
        );
        saleWithDebt.debt.total_paid_bs = totalPaidBs;
        saleWithDebt.debt.total_paid_usd = totalPaidUsd;
        saleWithDebt.debt.remaining_bs = Number(saleWithDebt.debt.amount_bs || 0) - totalPaidBs;
        saleWithDebt.debt.remaining_usd = Number(saleWithDebt.debt.amount_usd || 0) - totalPaidUsd;
      }
      return saleWithDebt;
    });

    return { sales: salesWithDebtInfo, total };
  }

  private async getCurrentStock(storeId: string, productId: string): Promise<number> {
    const result = await this.movementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', { productId })
      .getRawOne();

    return parseInt(result.stock, 10) || 0;
  }
}
