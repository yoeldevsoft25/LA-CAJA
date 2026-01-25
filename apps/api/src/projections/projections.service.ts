import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Customer } from '../database/entities/customer.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { DebtStatus } from '../database/entities/debt.entity';
import { randomUUID } from 'crypto';
import { WhatsAppMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { FiscalInvoicesService } from '../fiscal-invoices/fiscal-invoices.service';
import { WarehousesService } from '../warehouses/warehouses.service';

@Injectable()
export class ProjectionsService {
  private readonly logger = new Logger(ProjectionsService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(DebtPayment)
    private debtPaymentRepository: Repository<DebtPayment>,
    private dataSource: DataSource,
    private whatsappMessagingService: WhatsAppMessagingService,
    private fiscalInvoicesService: FiscalInvoicesService,
    private warehousesService: WarehousesService,
  ) {}

  private async resolveWarehouseId(
    storeId: string,
    candidateWarehouseId?: string | null,
  ): Promise<string | null> {
    if (candidateWarehouseId) {
      try {
        await this.warehousesService.findOne(storeId, candidateWarehouseId);
        return candidateWarehouseId;
      } catch (error) {
        this.logger.warn(
          `Bodega inválida en evento, usando bodega por defecto para store ${storeId}`,
        );
      }
    }

    try {
      const warehouse = await this.warehousesService.getDefaultOrFirst(storeId);
      return warehouse.id;
    } catch (error) {
      this.logger.warn(
        `No se pudo resolver bodega por defecto para store ${storeId}`,
      );
      return null;
    }
  }

  async projectEvent(event: Event): Promise<void> {
    switch (event.type) {
      case 'ProductCreated':
        await this.projectProductCreated(event);
        break;
      case 'ProductUpdated':
        await this.projectProductUpdated(event);
        break;
      case 'ProductDeactivated':
        await this.projectProductDeactivated(event);
        break;
      case 'PriceChanged':
        await this.projectPriceChanged(event);
        break;
      case 'StockReceived':
        await this.projectStockReceived(event);
        break;
      case 'StockAdjusted':
        await this.projectStockAdjusted(event);
        break;
      case 'SaleCreated':
        await this.projectSaleCreated(event);
        break;
      case 'CashSessionOpened':
        await this.projectCashSessionOpened(event);
        break;
      case 'CashSessionClosed':
        await this.projectCashSessionClosed(event);
        break;
      case 'CustomerCreated':
        await this.projectCustomerCreated(event);
        break;
      case 'CustomerUpdated':
        await this.projectCustomerUpdated(event);
        break;
      case 'DebtCreated':
        await this.projectDebtCreated(event);
        break;
      case 'DebtPaymentRecorded':
        await this.projectDebtPaymentRecorded(event);
        break;
      default:
        // Tipo de evento desconocido, no se proyecta
        break;
    }
  }

  private async projectProductCreated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.productRepository.findOne({
      where: { id: payload.product_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const product = this.productRepository.create({
      id: payload.product_id,
      store_id: event.store_id,
      name: payload.name,
      category: payload.category || null,
      sku: payload.sku || null,
      barcode: payload.barcode || null,
      price_bs: Number(payload.price_bs) || 0,
      price_usd: Number(payload.price_usd) || 0,
      cost_bs: Number(payload.cost_bs) || 0,
      cost_usd: Number(payload.cost_usd) || 0,
      is_active: payload.is_active !== false,
      low_stock_threshold: Number(payload.low_stock_threshold) || 0,
    });

    await this.productRepository.save(product);
  }

  private async projectProductUpdated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const product = await this.productRepository.findOne({
      where: { id: payload.product_id, store_id: event.store_id },
    });

    if (!product) {
      return; // Producto no existe
    }

    const patch = payload.patch || {};
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.category !== undefined) product.category = patch.category || null;
    if (patch.sku !== undefined) product.sku = patch.sku || null;
    if (patch.barcode !== undefined) product.barcode = patch.barcode || null;
    if (patch.low_stock_threshold !== undefined)
      product.low_stock_threshold = Number(patch.low_stock_threshold) || 0;

    await this.productRepository.save(product);
  }

  private async projectProductDeactivated(event: Event): Promise<void> {
    const payload = event.payload as any;
    await this.productRepository.update(
      { id: payload.product_id, store_id: event.store_id },
      { is_active: false },
    );
  }

  private async projectPriceChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    await this.productRepository.update(
      { id: payload.product_id, store_id: event.store_id },
      {
        price_bs: Number(payload.price_bs) || 0,
        price_usd: Number(payload.price_usd) || 0,
      },
    );
  }

  private async projectStockReceived(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.movementRepository.findOne({
      where: { id: payload.movement_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const qty = Number(payload.qty) || 0;
    const warehouseId = await this.resolveWarehouseId(
      event.store_id,
      payload.warehouse_id ?? null,
    );

    const movement = this.movementRepository.create({
      id: payload.movement_id,
      store_id: event.store_id,
      product_id: payload.product_id,
      variant_id: payload.variant_id ?? null,
      movement_type: 'received',
      qty_delta: qty,
      unit_cost_bs: Number(payload.unit_cost_bs) || 0,
      unit_cost_usd: Number(payload.unit_cost_usd) || 0,
      warehouse_id: warehouseId,
      note: payload.note || null,
      ref: payload.ref || null,
      happened_at: event.created_at,
    });

    await this.movementRepository.save(movement);

    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        payload.product_id,
        payload.variant_id ?? null,
        qty,
        event.store_id,
      );
    }
  }

  private async projectStockAdjusted(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.movementRepository.findOne({
      where: { id: payload.movement_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const qtyDelta = Number(payload.qty_delta) || 0;
    const warehouseId = await this.resolveWarehouseId(
      event.store_id,
      payload.warehouse_id ?? null,
    );

    const movement = this.movementRepository.create({
      id: payload.movement_id,
      store_id: event.store_id,
      product_id: payload.product_id,
      variant_id: payload.variant_id ?? null,
      movement_type: 'adjust',
      qty_delta: qtyDelta,
      unit_cost_bs: 0,
      unit_cost_usd: 0,
      warehouse_id: warehouseId,
      note: payload.note || null,
      ref: null,
      happened_at: event.created_at,
    });

    await this.movementRepository.save(movement);

    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        payload.product_id,
        payload.variant_id ?? null,
        qtyDelta,
        event.store_id,
      );
    }
  }

  private async projectSaleCreated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.saleRepository.findOne({
      where: { id: payload.sale_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    // ⚠️ VALIDACIÓN CRÍTICA: Verificar que el evento tiene actor_user_id
    if (!event.actor_user_id) {
      this.logger.error(
        `Evento SaleCreated ${event.event_id} no tiene actor_user_id. No se puede crear la venta sin identificar al responsable.`,
      );
      throw new Error(
        `No se puede crear la venta ${payload.sale_id}: el evento no contiene información del responsable (actor_user_id).`,
      );
    }

    // ⚠️ VALIDACIÓN CRÍTICA: Para ventas FIAO, verificar que hay customer_id
    if (payload.payment?.method === 'FIAO' && !payload.customer?.customer_id && !payload.customer_id) {
      this.logger.error(
        `Evento SaleCreated ${event.event_id} es una venta FIAO sin cliente. No se puede crear la venta.`,
      );
      throw new Error(
        `No se puede crear la venta FIAO ${payload.sale_id}: falta información del cliente.`,
      );
    }

    const warehouseId = await this.resolveWarehouseId(
      event.store_id,
      payload.warehouse_id ?? null,
    );

    // Crear venta
    const sale = this.saleRepository.create({
      id: payload.sale_id,
      store_id: event.store_id,
      cash_session_id: payload.cash_session_id || null,
      sold_at: payload.sold_at ? new Date(payload.sold_at) : event.created_at,
      exchange_rate: Number(payload.exchange_rate) || 0,
      currency: payload.currency || 'BS',
      totals: payload.totals || {},
      payment: payload.payment || {},
      customer_id: payload.customer?.customer_id || payload.customer_id || null,
      sold_by_user_id: event.actor_user_id, // ⚠️ CRÍTICO: Asignar responsable desde el evento
      note: payload.note || null,
    });

    const savedSale = await this.saleRepository.save(sale);

    // Crear items de venta
    if (payload.items && Array.isArray(payload.items)) {
      const items = payload.items.map((item: any) => {
        const isWeightProduct = Boolean(item.is_weight_product);
        const weightValue =
          item.weight_value !== undefined && item.weight_value !== null
            ? Number(item.weight_value)
            : null;
        const normalizedQty = isWeightProduct && weightValue !== null
          ? weightValue
          : Number(item.qty) || 0;

        return this.saleItemRepository.create({
          id: item.item_id || randomUUID(),
          sale_id: savedSale.id,
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          lot_id: item.lot_id ?? null,
          qty: normalizedQty,
          unit_price_bs: Number(item.unit_price_bs) || 0,
          unit_price_usd: Number(item.unit_price_usd) || 0,
          discount_bs: Number(item.discount_bs) || 0,
          discount_usd: Number(item.discount_usd) || 0,
          is_weight_product: isWeightProduct,
          weight_unit: item.weight_unit || null,
          weight_value: weightValue,
          price_per_weight_bs:
            item.price_per_weight_bs !== undefined &&
            item.price_per_weight_bs !== null
              ? Number(item.price_per_weight_bs)
              : null,
          price_per_weight_usd:
            item.price_per_weight_usd !== undefined &&
            item.price_per_weight_usd !== null
              ? Number(item.price_per_weight_usd)
              : null,
        });
      });

      await this.saleItemRepository.save(items);
    }

    // ⚡ OPTIMIZACIÓN: Crear movimientos de inventario en batch (descontar stock)
    // Nota: Para FIAO, el stock se descuenta igual
    if (payload.items && Array.isArray(payload.items)) {
      const stockUpdates: Array<{
        product_id: string;
        variant_id: string | null;
        qty_delta: number;
      }> = [];
      const movements = payload.items.map((item) => {
        const movementQty = item.is_weight_product && item.weight_value != null
          ? Number(item.weight_value)
          : Number(item.qty) || 0;
        const variantId = item.variant_id ?? null;
        if (warehouseId) {
          stockUpdates.push({
            product_id: item.product_id,
            variant_id: variantId,
            qty_delta: -movementQty,
          });
        }
        return this.movementRepository.create({
          id: randomUUID(),
          store_id: event.store_id,
          product_id: item.product_id,
          variant_id: variantId,
          movement_type: 'sold',
          qty_delta: -movementQty, // Negativo para descontar
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: `Venta ${payload.sale_id}`,
          ref: { sale_id: payload.sale_id, warehouse_id: warehouseId },
          happened_at: payload.sold_at
            ? new Date(payload.sold_at)
            : event.created_at,
        });
      });

      // Batch insert para mejor performance
      await this.movementRepository.save(movements);

      if (warehouseId && stockUpdates.length > 0) {
        await this.warehousesService.updateStockBatch(
          warehouseId,
          stockUpdates,
          event.store_id,
        );
      }
    }

    // ⚠️ CRÍTICO: Si es venta FIAO, SIEMPRE crear la deuda automáticamente
    // Esto es esencial para la trazabilidad - sin deuda, el sistema no puede rastrear quién debe qué
    // La validación de crédito ya se hizo antes (en el servicio de ventas o en el frontend)
    // Aquí solo creamos la deuda para mantener la integridad del sistema
    if (payload.payment?.method === 'FIAO') {
      if (!savedSale.customer_id) {
        // Esto no debería pasar porque ya validamos arriba, pero registramos el error
        this.logger.error(
          `❌ CRÍTICO: Venta FIAO ${payload.sale_id} sin customer_id. NO se puede crear la deuda. Esto causará problemas de trazabilidad.`,
        );
      } else {
        const customerId = savedSale.customer_id;
        const totalUsd = Number(payload.totals?.total_usd || 0);
        const totalBs = Number(payload.totals?.total_bs || 0);

        // Verificar si ya existe una deuda para esta venta (idempotencia)
        const existingDebt = await this.debtRepository.findOne({
          where: { sale_id: savedSale.id, store_id: event.store_id },
        });

        if (existingDebt) {
          this.logger.log(
            `Deuda ya existe para venta FIAO ${payload.sale_id}: ${existingDebt.id}`,
          );
        } else {
          // Crear la deuda - SIEMPRE, sin importar si el cliente tiene crédito o no
          // La validación de crédito ya se hizo antes de crear la venta
          const debt = this.debtRepository.create({
            id: randomUUID(),
            store_id: event.store_id,
            sale_id: savedSale.id,
            customer_id: customerId,
            created_at: savedSale.sold_at,
            amount_bs: totalBs,
            amount_usd: totalUsd,
            status: DebtStatus.OPEN,
          });

          await this.debtRepository.save(debt);
          
          // Log informativo
          const customer = await this.customerRepository.findOne({
            where: { id: customerId, store_id: event.store_id },
          });
          
          if (customer) {
            this.logger.log(
              `✅ Deuda creada para venta FIAO ${payload.sale_id}: ${debt.id} - Cliente: ${customer.name} (${customerId}) - Monto: $${totalUsd} USD / ${totalBs} Bs`,
            );
          } else {
            this.logger.warn(
              `⚠️ Deuda creada para venta FIAO ${payload.sale_id}: ${debt.id} - Cliente ID: ${customerId} (cliente no encontrado en BD) - Monto: $${totalUsd} USD / ${totalBs} Bs`,
            );
          }
        }
      }
    }

    // ⚠️ CRÍTICO: Generar factura fiscal automáticamente (igual que en sales.service.ts)
    // Esto es esencial para mantener la funcionalidad original del sistema
    // ⚡ OPTIMIZACIÓN: Ejecutar verificación de factura fiscal en paralelo con otras operaciones
    try {
      this.logger.log(
        `Verificando configuración fiscal para venta ${payload.sale_id} (store: ${event.store_id})`,
      );
      
      // ⚡ OPTIMIZACIÓN: Verificar configuración fiscal y factura existente en paralelo
      const [hasFiscalConfig, existingInvoice] = await Promise.all([
        this.fiscalInvoicesService.hasActiveFiscalConfig(event.store_id),
        this.fiscalInvoicesService.findBySale(event.store_id, savedSale.id),
      ]);
      
      this.logger.log(
        `Configuración fiscal para store ${event.store_id}: ${hasFiscalConfig ? 'ACTIVA' : 'INACTIVA'}`,
      );
      
      if (hasFiscalConfig) {
        // existingInvoice ya fue obtenido en paralelo arriba
        
        if (existingInvoice) {
          this.logger.log(
            `Factura fiscal existente encontrada para venta ${payload.sale_id}: ${existingInvoice.id} (status: ${existingInvoice.status})`,
          );
          
          if (existingInvoice.status === 'draft') {
            // Emitir factura si está en draft
            const issuedInvoice = await this.fiscalInvoicesService.issue(
              event.store_id,
              existingInvoice.id,
            );
            this.logger.log(
              `✅ Factura fiscal emitida automáticamente para venta ${payload.sale_id}: ${issuedInvoice.invoice_number} (fiscal: ${issuedInvoice.fiscal_number || 'N/A'})`,
            );
          } else if (existingInvoice.status === 'issued') {
            this.logger.log(
              `✅ Factura fiscal ya estaba emitida para venta ${payload.sale_id}: ${existingInvoice.invoice_number}`,
            );
          }
        } else {
          // Crear y emitir factura fiscal automáticamente
          this.logger.log(
            `Creando factura fiscal automática para venta ${payload.sale_id}...`,
          );
          
          const createdInvoice = await this.fiscalInvoicesService.createFromSale(
            event.store_id,
            savedSale.id,
            event.actor_user_id || null,
          );
          
          this.logger.log(
            `Factura fiscal creada (draft) para venta ${payload.sale_id}: ${createdInvoice.id}`,
          );
          
          const issuedInvoice = await this.fiscalInvoicesService.issue(
            event.store_id,
            createdInvoice.id,
          );
          
          this.logger.log(
            `✅ Factura fiscal creada y emitida automáticamente para venta ${payload.sale_id}: ${issuedInvoice.invoice_number} (fiscal: ${issuedInvoice.fiscal_number || 'N/A'})`,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ No hay configuración fiscal activa para store ${event.store_id}. No se generará factura fiscal para venta ${payload.sale_id}.`,
        );
      }
    } catch (error) {
      // No fallar la proyección si hay error en factura fiscal, pero loguear el error completo
      this.logger.error(
        `❌ Error generando factura fiscal automática para venta ${payload.sale_id}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Enviar notificación de WhatsApp si está habilitado (offline-first)
    // El mensaje se agregará a la cola incluso si no hay conexión o el bot está desconectado
    if (this.whatsappMessagingService) {
      try {
        // Obtener device_id y seq del evento si están disponibles (para tracking offline)
        const deviceId = (event as any).device_id || undefined;
        const seq = (event as any).seq || undefined;

        await this.whatsappMessagingService.sendSaleNotification(
          event.store_id,
          payload.sale_id,
          deviceId,
          seq,
        );
      } catch (error) {
        // No fallar la proyección si hay error en WhatsApp
        this.logger.warn(`Error enviando notificación de WhatsApp para venta ${payload.sale_id}:`, error);
      }
    }
  }

  private async projectCashSessionOpened(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.cashSessionRepository.findOne({
      where: { id: payload.session_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const session = this.cashSessionRepository.create({
      id: payload.session_id,
      store_id: event.store_id,
      opened_by: event.actor_user_id,
      opened_at: payload.opened_at
        ? new Date(payload.opened_at)
        : event.created_at,
      opening_amount_bs: Number(payload.opening_amount_bs || 0),
      opening_amount_usd: Number(payload.opening_amount_usd || 0),
      closed_at: null,
      closed_by: null,
      expected: null,
      counted: null,
      note: payload.note || null,
    });

    await this.cashSessionRepository.save(session);
  }

  private async projectCashSessionClosed(event: Event): Promise<void> {
    const payload = event.payload as any;
    const session = await this.cashSessionRepository.findOne({
      where: { id: payload.session_id, store_id: event.store_id },
    });

    if (!session) {
      return; // Sesión no existe
    }

    session.closed_at = payload.closed_at
      ? new Date(payload.closed_at)
      : event.created_at;
    session.closed_by = event.actor_user_id;
    session.expected = payload.expected || null;
    session.counted = payload.counted || null;
    session.note = payload.note || session.note;

    await this.cashSessionRepository.save(session);
  }

  private async projectCustomerCreated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.customerRepository.findOne({
      where: { id: payload.customer_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const customer = this.customerRepository.create({
      id: payload.customer_id,
      store_id: event.store_id,
      name: payload.name,
      phone: payload.phone || null,
      note: payload.note || null,
      updated_at: event.created_at,
    });

    await this.customerRepository.save(customer);
  }

  private async projectCustomerUpdated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const customer = await this.customerRepository.findOne({
      where: { id: payload.customer_id, store_id: event.store_id },
    });

    if (!customer) {
      return; // Cliente no existe
    }

    const patch = payload.patch || {};
    if (patch.name !== undefined) customer.name = patch.name;
    if (patch.phone !== undefined) customer.phone = patch.phone || null;
    if (patch.note !== undefined) customer.note = patch.note || null;
    customer.updated_at = new Date(event.created_at);

    await this.customerRepository.save(customer);
  }

  private async projectDebtCreated(event: Event): Promise<void> {
    const payload = event.payload as any;
    const exists = await this.debtRepository.findOne({
      where: { id: payload.debt_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const debt = this.debtRepository.create({
      id: payload.debt_id,
      store_id: event.store_id,
      sale_id: payload.sale_id || null,
      customer_id: payload.customer_id,
      created_at: payload.created_at
        ? new Date(payload.created_at)
        : event.created_at,
      amount_bs: Number(payload.amount_bs) || 0,
      amount_usd: Number(payload.amount_usd) || 0,
      status: DebtStatus.OPEN,
    });

    await this.debtRepository.save(debt);
  }

  private async projectDebtPaymentRecorded(event: Event): Promise<void> {
    const payload = event.payload as any;

    // Validar campos requeridos
    if (!payload.payment_id) {
      this.logger.error(
        `Error: payment_id faltante en evento ${event.event_id}`,
      );
      throw new Error(
        `payment_id es requerido en el payload del evento DebtPaymentRecorded`,
      );
    }

    if (!payload.debt_id) {
      this.logger.error(
        `Error: debt_id faltante en evento ${event.event_id}`,
        JSON.stringify(payload),
      );
      throw new Error(
        `debt_id es requerido en el payload del evento DebtPaymentRecorded. Evento: ${event.event_id}`,
      );
    }

    if (!payload.method) {
      this.logger.error(`Error: method faltante en evento ${event.event_id}`);
      throw new Error(
        `method es requerido en el payload del evento DebtPaymentRecorded`,
      );
    }

    // Verificar que el pago no existe ya (idempotencia)
    const exists = await this.debtPaymentRepository.findOne({
      where: { id: payload.payment_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    // Verificar que la deuda existe antes de crear el pago
    const debt = await this.debtRepository.findOne({
      where: { id: payload.debt_id, store_id: event.store_id },
    });

    if (!debt) {
      this.logger.error(
        `Deuda ${payload.debt_id} no encontrada para store ${event.store_id} en evento ${event.event_id}`,
      );
      throw new Error(
        `La deuda ${payload.debt_id} no existe para la tienda ${event.store_id}`,
      );
    }

    // Crear el pago usando SQL directo para evitar problemas con relaciones TypeORM
    const paidAt = payload.paid_at
      ? new Date(payload.paid_at)
      : event.created_at;
    const amountBs = Number(payload.amount_bs) || 0;
    const amountUsd = Number(payload.amount_usd) || 0;

    // Validar que debt_id no sea null antes de insertar
    if (!payload.debt_id) {
      this.logger.error(
        `Error crítico: debt_id es null/undefined`,
        JSON.stringify(payload),
      );
      throw new Error(
        `debt_id es requerido y no puede ser null. Evento: ${event.event_id}`,
      );
    }

    this.logger.debug(
      `Insertando pago - payment_id: ${payload.payment_id}, store_id: ${event.store_id}, debt_id: ${payload.debt_id}`,
    );

    // Usar SQL directo para insertar (igual que en debts.service.ts)
    await this.dataSource.query(
      `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        payload.payment_id,
        event.store_id,
        payload.debt_id,
        paidAt,
        amountBs,
        amountUsd,
        payload.method,
        payload.note || null,
      ],
    );

    this.logger.debug(
      `Pago insertado exitosamente - payment_id: ${payload.payment_id}`,
    );

    // Actualizar estado de la deuda si está completamente pagada
    // Recargar la deuda con todos los pagos para calcular correctamente
    const updatedDebt = await this.debtRepository.findOne({
      where: { id: payload.debt_id, store_id: event.store_id },
      relations: ['payments'],
    });

    if (updatedDebt) {
      const totalPaidBs = (updatedDebt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_bs),
        0,
      );
      const totalPaidUsd = (updatedDebt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd),
        0,
      );

      const debtAmountBs = Number(updatedDebt.amount_bs);
      const debtAmountUsd = Number(updatedDebt.amount_usd);

      if (totalPaidBs >= debtAmountBs && totalPaidUsd >= debtAmountUsd) {
        updatedDebt.status = DebtStatus.PAID;
        await this.debtRepository.save(updatedDebt);
      } else if (totalPaidBs > 0 || totalPaidUsd > 0) {
        updatedDebt.status = DebtStatus.PARTIAL;
        await this.debtRepository.save(updatedDebt);
      }
    }
  }
}
