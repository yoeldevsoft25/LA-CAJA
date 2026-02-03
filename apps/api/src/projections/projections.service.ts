import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { RecipeIngredient } from '../database/entities/recipe-ingredient.entity';
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
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import {
  SaleCreatedPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  ProductDeactivatedPayload,
  RecipeIngredientsUpdatedPayload,
  PriceChangedPayload,
  StockReceivedPayload,
  StockAdjustedPayload,
  CashSessionOpenedPayload,
  CashSessionClosedPayload,
  CustomerCreatedPayload,
  CustomerUpdatedPayload,
  DebtCreatedPayload,
  DebtPaymentRecordedPayload,
} from '../sync/dto/sync-types';

@Injectable()
export class ProjectionsService {
  private readonly logger = new Logger(ProjectionsService.name);

  private readonly truthyValues = new Set(['1', 'true', 't', 'yes', 'y']);

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
    private metricsService: SyncMetricsService,
    private invoiceSeriesService: InvoiceSeriesService,
  ) { }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      return this.truthyValues.has(value.trim().toLowerCase());
    }
    return false;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toSaleTotals(totals?: SaleCreatedPayload['totals']): Sale['totals'] {
    return {
      subtotal_bs: this.toNumber(totals?.subtotal_bs),
      subtotal_usd: this.toNumber(totals?.subtotal_usd),
      discount_bs: this.toNumber(totals?.discount_total_bs),
      discount_usd: this.toNumber(totals?.discount_total_usd),
      total_bs: this.toNumber(totals?.total_bs),
      total_usd: this.toNumber(totals?.total_usd),
    };
  }

  private toSalePayment(
    payment?: SaleCreatedPayload['payment'],
  ): Sale['payment'] {
    const normalizedMethod =
      typeof payment?.method === 'string' && payment.method.trim().length > 0
        ? payment.method
        : 'UNKNOWN';
    const normalized = {
      ...(payment ?? {}),
      method: normalizedMethod,
    };
    return normalized as unknown as Sale['payment'];
  }

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
      case 'RecipeIngredientsUpdated':
        await this.projectRecipeIngredientsUpdated(event);
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
    const payload = event.payload as unknown as ProductCreatedPayload;
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
      description: payload.description || null,
      image_url: payload.image_url || null,
      is_recipe: !!payload.is_recipe,
      profit_margin: Number(payload.profit_margin) || 0,
      product_type:
        (payload.product_type as 'prepared' | 'sale_item' | 'ingredient') ||
        (payload.is_recipe ? 'prepared' : 'sale_item'),
      is_visible_public: payload.is_visible_public ?? false,
      public_name: payload.public_name || null,
      public_description: payload.public_description || null,
      public_image_url: payload.public_image_url || null,
      public_category: payload.public_category || null,
    });

    await this.productRepository.save(product);
  }

  private async projectProductUpdated(event: Event): Promise<void> {
    const payload = event.payload as unknown as ProductUpdatedPayload;
    const product = await this.productRepository.findOne({
      where: { id: payload.product_id, store_id: event.store_id },
    });

    if (!product) {
      return; // Producto no existe
    }

    // 🛡️ OFFLINE-FIRST GUARD: Evitar updates fuera de orden
    if (product.updated_at && event.created_at < product.updated_at) {
      this.logger.warn(
        `Ignoring out-of-order update for product ${product.id}. Event time: ${event.created_at.toISOString()}, Current updated_at: ${product.updated_at.toISOString()}`,
      );
      this.metricsService.trackOutOfOrderEvent(
        event.event_id,
        product.id,
        product.updated_at.getTime(),
        event.created_at.getTime(),
      );
      return;
    }

    const patch = payload.patch || {};
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.category !== undefined) product.category = patch.category || null;
    if (patch.sku !== undefined) product.sku = patch.sku || null;
    if (patch.barcode !== undefined) product.barcode = patch.barcode || null;
    if (patch.low_stock_threshold !== undefined)
      product.low_stock_threshold = Number(patch.low_stock_threshold) || 0;
    if (patch.description !== undefined)
      product.description = patch.description || null;
    if (patch.image_url !== undefined)
      product.image_url = patch.image_url || null;
    if (patch.is_recipe !== undefined) product.is_recipe = !!patch.is_recipe;
    if (patch.profit_margin !== undefined)
      product.profit_margin = Number(patch.profit_margin) || 0;
    if (patch.product_type !== undefined)
      product.product_type = patch.product_type as
        | 'prepared'
        | 'sale_item'
        | 'ingredient';
    if (patch.is_visible_public !== undefined)
      product.is_visible_public = !!patch.is_visible_public;
    if (patch.public_name !== undefined)
      product.public_name = patch.public_name || null;
    if (patch.public_description !== undefined)
      product.public_description = patch.public_description || null;
    if (patch.public_image_url !== undefined)
      product.public_image_url = patch.public_image_url || null;
    if (patch.public_category !== undefined)
      product.public_category = patch.public_category || null;

    await this.productRepository.save(product);
  }

  private async projectProductDeactivated(event: Event): Promise<void> {
    const payload = event.payload as unknown as ProductDeactivatedPayload;
    const product = await this.productRepository.findOne({
      where: { id: payload.product_id, store_id: event.store_id },
    });

    if (!product) return;

    // 🛡️ OFFLINE-FIRST GUARD
    if (product.updated_at && event.created_at < product.updated_at) {
      this.logger.warn(
        `Ignoring out-of-order deactivation for product ${product.id}`,
      );
      this.metricsService.trackOutOfOrderEvent(
        event.event_id,
        product.id,
        product.updated_at.getTime(),
        event.created_at.getTime(),
      );
      return;
    }

    product.is_active = false;
    await this.productRepository.save(product);
  }

  private async projectPriceChanged(event: Event): Promise<void> {
    const payload = event.payload as unknown as PriceChangedPayload;
    await this.productRepository.update(
      { id: payload.product_id, store_id: event.store_id },
      {
        price_bs: Number(payload.price_bs) || 0,
        price_usd: Number(payload.price_usd) || 0,
      },
    );
  }

  private async projectRecipeIngredientsUpdated(event: Event): Promise<void> {
    const payload = event.payload as unknown as RecipeIngredientsUpdatedPayload;
    const productId = payload.product_id;

    if (!productId) return;

    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: event.store_id },
      select: ['id'],
    });

    if (!product) return;

    const ingredients = Array.isArray(payload.ingredients)
      ? payload.ingredients
      : [];

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RecipeIngredient, { recipe_product_id: productId });

      if (ingredients.length === 0) return;

      let ingredientIds = [
        ...new Set(ingredients.map((i) => i.ingredient_product_id)),
      ];
      if (ingredientIds.includes(productId)) {
        this.logger.warn(
          `Receta ${productId} incluye ingrediente inválido (auto-referencia)`,
        );
        ingredientIds = ingredientIds.filter((id) => id !== productId);
      }

      if (ingredientIds.length === 0) return;

      const validIngredients = await manager.getRepository(Product).find({
        where: { id: In(ingredientIds), store_id: event.store_id },
        select: ['id'],
      });
      const validIds = new Set(validIngredients.map((item) => item.id));

      const filtered = ingredients.filter((i) => {
        const qty = Number(i.qty);
        return (
          validIds.has(i.ingredient_product_id) &&
          Number.isFinite(qty) &&
          qty > 0
        );
      });

      if (filtered.length === 0) return;

      const newIngredients = filtered.map((i) =>
        manager.create(RecipeIngredient, {
          id: randomUUID(),
          recipe_product_id: productId,
          ingredient_product_id: i.ingredient_product_id,
          qty: Number(i.qty),
          unit: i.unit ?? null,
        }),
      );

      await manager.save(RecipeIngredient, newIngredients);
    });
  }

  private async projectStockReceived(event: Event): Promise<void> {
    const payload = event.payload as unknown as StockReceivedPayload;
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
    const payload = event.payload as unknown as StockAdjustedPayload;
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
    const payload = event.payload as unknown as SaleCreatedPayload;
    const exists = await this.saleRepository.findOne({
      where: { id: payload.sale_id, store_id: event.store_id },
      relations: ['items'],
    });

    if (exists) {
      if (exists.updated_at && event.created_at < exists.updated_at) {
        this.logger.warn(
          `Ignoring out-of-order SaleCreated for ${payload.sale_id}`,
        );
        return;
      }

      // ⚡ SMART IDEMPOTENCY: Solo retornar si la venta está COMPLETA (tiene items)
      if (exists.items && exists.items.length > 0) {
        return; // Ya existe y está completa
      }

      this.logger.warn(`Reparando venta parcial detectada: ${payload.sale_id}`);
    }

    // ⚡ CRITICAL: Shared Transaction for Atomicity
    const savedSale = await this.dataSource.transaction(async (manager) => {
      // ⚠️ VALIDACIÓN CRÍTICA: Verificar que el evento tiene actor_user_id
      if (!event.actor_user_id) {
        throw new Error(
          `No se puede crear la venta ${payload.sale_id}: el evento no contiene información del responsable (actor_user_id).`,
        );
      }

      const warehouseId = await this.resolveWarehouseId(
        event.store_id,
        payload.warehouse_id ?? null,
      );

      // 🔢 GENERACIÓN DE SECUENCIA DE VENTA (Robust & Transactional)
      const result = await manager.query(
        `INSERT INTO sale_sequences (store_id, current_number, created_at, updated_at)
         VALUES ($1, 1, NOW(), NOW())
         ON CONFLICT (store_id)
         DO UPDATE SET current_number = sale_sequences.current_number + 1, updated_at = NOW()
         RETURNING current_number`,
        [event.store_id],
      );
      const saleNumber = Number(result?.[0]?.current_number ?? 0);
      if (!saleNumber) {
        throw new Error('No se pudo generar el número de venta');
      }

      // ✅ FIX OFFLINE-FIRST: Generar número de factura usando InvoiceSeriesService
      // Esto asegura que las ventas sincronizadas desde offline tengan invoice_full_number
      let invoiceSeriesId: string | null = null;
      let invoiceNumber: string | null = null;
      let invoiceFullNumber: string | null = null;

      try {
        const invoiceData = await this.invoiceSeriesService.generateNextInvoiceNumber(
          event.store_id,
          undefined, // Usar serie por defecto
        );
        invoiceSeriesId = invoiceData.series.id;
        invoiceNumber = invoiceData.invoice_number;
        invoiceFullNumber = invoiceData.invoice_full_number;
        this.logger.debug(
          `[PROJECTION] Número de factura generado: ${invoiceFullNumber} para venta ${payload.sale_id}`,
        );
      } catch (error) {
        // Si no hay series configuradas, la venta se crea sin número de factura
        this.logger.warn(
          `[PROJECTION] No se pudo generar número de factura para venta ${payload.sale_id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Crear venta (Upsert)
      const sale = manager.getRepository(Sale).create({
        id: payload.sale_id,
        store_id: event.store_id,
        sale_number: saleNumber,
        cash_session_id: payload.cash_session_id || null,
        sold_at: payload.sold_at ? new Date(payload.sold_at) : event.created_at,
        exchange_rate: this.toNumber(payload.exchange_rate),
        currency: (payload.currency as 'BS' | 'USD' | 'MIXED') || 'BS',
        totals: this.toSaleTotals(payload.totals),
        payment: this.toSalePayment(payload.payment),
        customer_id:
          payload.customer?.customer_id || payload.customer_id || null,
        sold_by_user_id: event.actor_user_id,
        note: payload.note || null,
        // ✅ FIX: Asignar invoice_full_number a ventas sincronizadas
        invoice_series_id: invoiceSeriesId,
        invoice_number: invoiceNumber,
        invoice_full_number: invoiceFullNumber,
      });

      const s = await manager.getRepository(Sale).save(sale);

      // Crear items de venta
      if (payload.items && Array.isArray(payload.items)) {
        const items = payload.items.map((item) => {
          const isWeightProduct = this.toBoolean(item.is_weight_product);
          const weightValue = this.toNullableNumber(item.weight_value);
          const normalizedQty =
            isWeightProduct && weightValue !== null
              ? weightValue
              : this.toNumber(item.qty);

          return manager.getRepository(SaleItem).create({
            id: item.item_id || randomUUID(),
            sale_id: s.id,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            lot_id: item.lot_id || null,
            qty: normalizedQty,
            unit_price_bs: this.toNumber(item.unit_price_bs),
            unit_price_usd: this.toNumber(item.unit_price_usd),
            discount_bs: this.toNumber(item.discount_bs),
            discount_usd: this.toNumber(item.discount_usd),
            is_weight_product: isWeightProduct,
            weight_unit:
              (item.weight_unit as 'kg' | 'g' | 'lb' | 'oz' | null) || null,
            weight_value: weightValue,
            price_per_weight_bs: this.toNullableNumber(
              item.price_per_weight_bs,
            ),
            price_per_weight_usd: this.toNullableNumber(
              item.price_per_weight_usd,
            ),
          });
        });

        await manager.getRepository(SaleItem).save(items);
      }

      // Movimientos de inventario
      if (payload.items && Array.isArray(payload.items)) {
        // ⚡ IDEMPOTENCY GUARD: Verificar si ya existen movimientos para esta venta
        const existingMovements = await manager
          .getRepository(InventoryMovement)
          .createQueryBuilder('im')
          .where("im.ref->>'sale_id' = :saleId", { saleId: payload.sale_id })
          .getCount();

        if (existingMovements === 0) {
          const stockUpdates: Array<{
            product_id: string;
            variant_id: string | null;
            qty_delta: number;
          }> = [];

          const movements = payload.items.map((item) => {
            const movementQty =
              this.toBoolean(item.is_weight_product) &&
                item.weight_value != null
                ? this.toNumber(item.weight_value)
                : this.toNumber(item.qty);
            const variantId = item.variant_id ?? null;
            if (warehouseId) {
              stockUpdates.push({
                product_id: item.product_id,
                variant_id: variantId,
                qty_delta: -movementQty,
              });
            }
            return manager.getRepository(InventoryMovement).create({
              id: randomUUID(),
              store_id: event.store_id,
              product_id: item.product_id,
              variant_id: variantId,
              movement_type: 'sold',
              qty_delta: -movementQty,
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

          await manager.getRepository(InventoryMovement).save(movements);

          if (warehouseId && stockUpdates.length > 0) {
            // ⚡ ATOMICITY: Pass manager
            await this.warehousesService.updateStockBatch(
              warehouseId,
              stockUpdates,
              event.store_id,
              manager,
            );
          }
        }
      }

      // Deuda FIAO
      if (payload.payment?.method === 'FIAO' && s.customer_id) {
        // ⚡ IDEMPOTENCY GUARD: Verificar si ya existe deuda
        const existingDebt = await manager.getRepository(Debt).findOne({
          where: { sale_id: payload.sale_id, store_id: event.store_id },
        });

        if (!existingDebt) {
          const debt = manager.getRepository(Debt).create({
            id: randomUUID(),
            store_id: event.store_id,
            sale_id: s.id,
            customer_id: s.customer_id,
            created_at: s.sold_at,
            amount_bs: Number(payload.totals?.total_bs || 0),
            amount_usd: Number(payload.totals?.total_usd || 0),
            status: DebtStatus.OPEN,
          });
          await manager.getRepository(Debt).save(debt);
        }
      }

      return s;
    });

    // ⚡ OPTIMIZACIÓN: Facturación y notificaciones (fuera de la transacción pesada)
    // Estos son side-effects que NO deben bloquear la transacción principal si fallan
    try {
      const [hasFiscalConfig, existingInvoice] = await Promise.all([
        this.fiscalInvoicesService.hasActiveFiscalConfig(event.store_id),
        this.fiscalInvoicesService.findBySale(event.store_id, savedSale.id),
      ]);

      if (hasFiscalConfig && this.toBoolean(payload.generate_fiscal_invoice)) {
        if (existingInvoice) {
          if (existingInvoice.status === 'draft') {
            await this.fiscalInvoicesService.issue(
              event.store_id,
              existingInvoice.id,
            );
          }
        } else {
          const createdInvoice =
            await this.fiscalInvoicesService.createFromSale(
              event.store_id,
              savedSale.id,
              event.actor_user_id || null,
            );
          await this.fiscalInvoicesService.issue(
            event.store_id,
            createdInvoice.id,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error en factura fiscal automática para venta ${payload.sale_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (this.whatsappMessagingService) {
      try {
        await this.whatsappMessagingService.sendSaleNotification(
          event.store_id,
          payload.sale_id,
          event.device_id,
          event.seq,
        );
      } catch (error) {
        this.logger.warn(
          `Error en notificación WhatsApp para venta ${payload.sale_id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async projectCashSessionOpened(event: Event): Promise<void> {
    const payload = event.payload as unknown as CashSessionOpenedPayload;
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
    const payload = event.payload as unknown as CashSessionClosedPayload;
    const session = await this.cashSessionRepository.findOne({
      where: { id: payload.session_id, store_id: event.store_id },
    });

    if (!session) {
      return; // Sesión no existe
    }

    // 🛡️ OFFLINE-FIRST GUARD
    if (session.updated_at && event.created_at < session.updated_at) {
      this.logger.warn(`Ignoring out-of-order session close for ${session.id}`);
      return;
    }

    session.closed_at = payload.closed_at
      ? new Date(payload.closed_at)
      : event.created_at;
    session.closed_by = event.actor_user_id;
    session.expected =
      (payload.expected as unknown as { cash_bs: number; cash_usd: number }) ||
      null;
    session.counted =
      (payload.counted as unknown as { cash_bs: number; cash_usd: number }) ||
      null;
    session.note = payload.note || session.note;

    await this.cashSessionRepository.save(session);
  }

  private async projectCustomerCreated(event: Event): Promise<void> {
    const payload = event.payload as unknown as CustomerCreatedPayload;
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
    const payload = event.payload as unknown as CustomerUpdatedPayload;
    const customer = await this.customerRepository.findOne({
      where: { id: payload.customer_id, store_id: event.store_id },
    });

    if (!customer) {
      return; // Cliente no existe
    }

    // 🛡️ OFFLINE-FIRST GUARD
    if (customer.updated_at && event.created_at < customer.updated_at) {
      this.logger.warn(
        `Ignoring out-of-order update for customer ${customer.id}`,
      );
      this.metricsService.trackOutOfOrderEvent(
        event.event_id,
        customer.id,
        customer.updated_at.getTime(),
        event.created_at.getTime(),
      );
      return;
    }

    const patch = payload.patch || {};
    if (patch.name !== undefined) customer.name = patch.name;
    if (patch.phone !== undefined) customer.phone = patch.phone || null;
    if (patch.note !== undefined) customer.note = patch.note || null;
    customer.updated_at = new Date(event.created_at);

    await this.customerRepository.save(customer);
  }

  private async projectDebtCreated(event: Event): Promise<void> {
    const payload = event.payload as unknown as DebtCreatedPayload;
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
      note: payload.note ? String(payload.note) : null,
      status: DebtStatus.OPEN,
    });

    await this.debtRepository.save(debt);
  }

  private async projectDebtPaymentRecorded(event: Event): Promise<void> {
    const payload = event.payload as unknown as DebtPaymentRecordedPayload;

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

    await this.debtPaymentRepository.save(
      this.debtPaymentRepository.create({
        id: payload.payment_id,
        store_id: event.store_id,
        debt_id: payload.debt_id,
        amount_bs: Number(payload.amount_bs) || 0,
        amount_usd: Number(payload.amount_usd) || 0,
        method: payload.method,
        paid_at: paidAt,
        note: payload.note || null,
      }),
    );
  }
}
