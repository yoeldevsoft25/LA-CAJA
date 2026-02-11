import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  In,
  IsNull,
  MoreThan,
} from 'typeorm';
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
import { CashLedgerEntry } from '../database/entities/cash-ledger-entry.entity';
import { StockEscrow } from '../database/entities/stock-escrow.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { randomUUID } from 'crypto';
import { WhatsAppMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { FiscalInvoicesService } from '../fiscal-invoices/fiscal-invoices.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import { AccountingService } from '../accounting/accounting.service';
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
  CashLedgerEntryCreatedPayload,
  StockDeltaAppliedPayload,
  StockQuotaGrantedPayload,
  StockQuotaTransferredPayload,
  StockQuotaReclaimedPayload,
  SaleVoidedPayload,
} from '../sync/dto/sync-types';

export class ProjectionDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionDependencyError';
  }
}

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
    @InjectRepository(CashLedgerEntry)
    private cashLedgerRepository: Repository<CashLedgerEntry>,
    @InjectRepository(StockEscrow)
    private stockEscrowRepository: Repository<StockEscrow>,
    private dataSource: DataSource,
    private whatsappMessagingService: WhatsAppMessagingService,
    private fiscalInvoicesService: FiscalInvoicesService,
    private accountingService: AccountingService,
    private warehousesService: WarehousesService,
    private metricsService: SyncMetricsService,
    private invoiceSeriesService: InvoiceSeriesService,
  ) {}

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

  private resolveSaleActorUserId(
    event: Event,
    payload: SaleCreatedPayload,
  ): string | null {
    const extendedPayload = payload as Record<string, any>;
    const metadata =
      extendedPayload?.metadata && typeof extendedPayload.metadata === 'object'
        ? (extendedPayload.metadata as Record<string, any>)
        : {};

    const candidates: Array<unknown> = [
      event.actor_user_id,
      extendedPayload.sold_by_user_id,
      extendedPayload.user_id,
      metadata.user_id,
      metadata.actor_user_id,
      metadata.sold_by_user_id,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return null;
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

  private async ensureProductExists(
    storeId: string,
    productId: string,
    eventId: string,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
      select: ['id'],
    });

    if (!product) {
      throw new ProjectionDependencyError(
        `Dependency not ready: product ${productId} missing for event ${eventId}`,
      );
    }
  }

  private async ensureCustomerExists(
    storeId: string,
    customerId: string,
    eventId: string,
  ): Promise<void> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, store_id: storeId },
      select: ['id'],
    });

    if (!customer) {
      throw new ProjectionDependencyError(
        `Dependency not ready: customer ${customerId} missing for event ${eventId}`,
      );
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
      case 'DebtPaymentAdded': // Alias
        await this.projectDebtPaymentRecorded(event);
        break;
      case 'CashLedgerEntryCreated':
        await this.projectCashLedgerEntryCreated(event);
        break;
      case 'StockDeltaApplied':
        await this.projectStockDeltaApplied(event);
        break;
      case 'StockQuotaGranted':
        await this.projectStockQuotaGranted(event);
        break;
      case 'StockQuotaTransferred':
        await this.projectStockQuotaTransferred(event);
        break;
      case 'StockQuotaReclaimed':
        await this.projectStockQuotaReclaimed(event);
        break;
      case 'SaleVoided':
        await this.projectSaleVoided(event);
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

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

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

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

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
    const saleActorUserId = this.resolveSaleActorUserId(event, payload);
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

    const productIds = Array.from(
      new Set((payload.items || []).map((item) => item.product_id).filter(Boolean)),
    );
    for (const productId of productIds) {
      await this.ensureProductExists(event.store_id, productId, event.event_id);
    }

    const customerId = payload.customer?.customer_id || payload.customer_id;
    if (customerId) {
      await this.ensureCustomerExists(event.store_id, customerId, event.event_id);
    }

    // ⚡ CRITICAL: Shared Transaction for Atomicity
    const savedSale = await this.dataSource.transaction(async (manager) => {
      if (!saleActorUserId) {
        this.logger.warn(
          `SaleCreated ${payload.sale_id} sin actor_user_id. Se proyectará con sold_by_user_id = NULL para evitar gap de proyección.`,
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

      // ✅ FIX OFFLINE-FIRST: Resolver número de factura
      // Phase 3: Si el cliente ya proveyó el número (offline-safe), lo usamos.
      let invoiceSeriesId: string | null = payload.invoice_series_id || null;
      let invoiceNumber: string | null = payload.invoice_number || null;
      let invoiceFullNumber: string | null = null;
      const fiscalNumber = payload.fiscal_number?.toString() || null;

      try {
        if (invoiceNumber && invoiceSeriesId) {
          const series = await this.invoiceSeriesService.getSeriesById(
            event.store_id,
            invoiceSeriesId,
          );
          const prefix = series.prefix || null;
          const seriesCode = series.series_code || 'FAC';
          invoiceFullNumber = prefix
            ? `${prefix}-${seriesCode}-${invoiceNumber}`
            : `${seriesCode}-${invoiceNumber}`;
        } else {
          const invoiceData =
            await this.invoiceSeriesService.generateNextInvoiceNumber(
              event.store_id,
              invoiceSeriesId || undefined,
            );
          invoiceSeriesId = invoiceData.series.id;
          invoiceNumber = invoiceData.invoice_number;
          invoiceFullNumber = invoiceData.invoice_full_number;
        }

        this.logger.debug(
          `[PROJECTION] Número de factura resuelto: ${invoiceFullNumber} para venta ${payload.sale_id}`,
        );
      } catch (error) {
        this.logger.warn(
          `[PROJECTION] No se pudo resolver número de factura para venta ${payload.sale_id}: ${error instanceof Error ? error.message : String(error)}`,
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
        sold_by_user_id: saleActorUserId,
        note: payload.note || null,
        // ✅ FIX: Asignar invoice_full_number y fiscal_number a ventas sincronizadas
        invoice_series_id: invoiceSeriesId,
        invoice_number: invoiceNumber,
        fiscal_number: fiscalNumber,
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

          // ⚡ POINT 6: Escrow Consumption (Prioridad a la cuota del dispositivo)
          const productIds = payload.items.map((i) => i.product_id);
          const deviceEscrows = event.device_id
            ? await manager.getRepository(StockEscrow).find({
                where: {
                  store_id: event.store_id,
                  device_id: event.device_id,
                  product_id: In(productIds),
                  expires_at: MoreThan(new Date()),
                },
              })
            : [];

          const escrowMap = new Map<string, StockEscrow>();
          for (const se of deviceEscrows) {
            const key = `${se.product_id}:${se.variant_id || 'null'}`;
            escrowMap.set(key, se);
          }

          const movements: InventoryMovement[] = [];

          for (const item of payload.items) {
            const totalQty =
              this.toBoolean(item.is_weight_product) &&
              item.weight_value != null
                ? this.toNumber(item.weight_value)
                : this.toNumber(item.qty);

            const variantId = item.variant_id ?? null;
            const escrowKey = `${item.product_id}:${variantId || 'null'}`;
            const escrow = escrowMap.get(escrowKey);

            let qtyFromEscrow = 0;
            if (escrow && Number(escrow.qty_granted) > 0) {
              qtyFromEscrow = Math.min(totalQty, Number(escrow.qty_granted));
              escrow.qty_granted = Number(escrow.qty_granted) - qtyFromEscrow;
              await manager.save(escrow);
            }

            const qtyFromWarehouse = totalQty - qtyFromEscrow;

            if (qtyFromEscrow > 0) {
              movements.push(
                manager.getRepository(InventoryMovement).create({
                  id: randomUUID(),
                  store_id: event.store_id,
                  product_id: item.product_id,
                  variant_id: variantId,
                  movement_type: 'sold',
                  qty_delta: -qtyFromEscrow,
                  from_escrow: true,
                  warehouse_id: warehouseId,
                  note: `Venta ${payload.sale_id} (Escrow)`,
                  ref: { sale_id: payload.sale_id, warehouse_id: warehouseId },
                  happened_at: payload.sold_at
                    ? new Date(payload.sold_at)
                    : event.created_at,
                }),
              );
            }

            if (qtyFromWarehouse > 0) {
              movements.push(
                manager.getRepository(InventoryMovement).create({
                  id: randomUUID(),
                  store_id: event.store_id,
                  product_id: item.product_id,
                  variant_id: variantId,
                  movement_type: 'sold',
                  qty_delta: -qtyFromWarehouse,
                  from_escrow: false,
                  warehouse_id: warehouseId,
                  note: `Venta ${payload.sale_id}`,
                  ref: { sale_id: payload.sale_id, warehouse_id: warehouseId },
                  happened_at: payload.sold_at
                    ? new Date(payload.sold_at)
                    : event.created_at,
                }),
              );

              if (warehouseId) {
                stockUpdates.push({
                  product_id: item.product_id,
                  variant_id: variantId,
                  qty_delta: -qtyFromWarehouse,
                });
              }
            }
          }

          if (movements.length > 0) {
            await manager.getRepository(InventoryMovement).save(movements);
          }

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

    // ⚡ OPTIMIZACIÓN: Facturación y contabilidad (fuera de la transacción pesada)
    // Estos son side-effects que NO deben bloquear la transacción principal si fallan
    let fiscalInvoiceForAccounting: FiscalInvoice | null = null;

    try {
      const [hasFiscalConfig, existingInvoice] = await Promise.all([
        this.fiscalInvoicesService.hasActiveFiscalConfig(event.store_id),
        this.fiscalInvoicesService.findBySale(event.store_id, savedSale.id),
      ]);

      if (hasFiscalConfig && this.toBoolean(payload.generate_fiscal_invoice)) {
        if (existingInvoice) {
          if (existingInvoice.status === 'draft') {
            fiscalInvoiceForAccounting = await this.fiscalInvoicesService.issue(
              event.store_id,
              existingInvoice.id,
            );
          } else {
            fiscalInvoiceForAccounting = existingInvoice;
          }
        } else {
          const createdInvoice =
            await this.fiscalInvoicesService.createFromSale(
              event.store_id,
              savedSale.id,
              saleActorUserId,
            );
          fiscalInvoiceForAccounting = await this.fiscalInvoicesService.issue(
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

    try {
      const existingEntries = await this.accountingService.findEntriesBySale(
        event.store_id,
        savedSale.id,
      );

      if (existingEntries.length === 0) {
        const issuedInvoice =
          fiscalInvoiceForAccounting?.status === 'issued'
            ? fiscalInvoiceForAccounting
            : await this.fiscalInvoicesService.findBySale(
                event.store_id,
                savedSale.id,
              );

        if (issuedInvoice && issuedInvoice.status === 'issued') {
          await this.accountingService.generateEntryFromFiscalInvoice(
            event.store_id,
            issuedInvoice,
          );
        } else {
          const saleForAccounting = await this.saleRepository.findOne({
            where: { id: savedSale.id, store_id: event.store_id },
            relations: ['items', 'items.product', 'customer'],
          });

          if (!saleForAccounting) {
            this.logger.warn(
              `Venta ${savedSale.id} no encontrada para generar asiento contable post-proyección`,
            );
          } else {
            await this.accountingService.generateEntryFromSale(
              event.store_id,
              saleForAccounting,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error generando asiento contable automático para venta ${payload.sale_id}: ${error instanceof Error ? error.message : String(error)}`,
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

    await this.ensureCustomerExists(
      event.store_id,
      payload.customer_id,
      event.event_id,
    );

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

  private async projectCashLedgerEntryCreated(event: Event): Promise<void> {
    const payload = event.payload as unknown as CashLedgerEntryCreatedPayload;
    if (!payload.entry_id) return;

    // Idempotency Guard
    const exists = await this.cashLedgerRepository.findOne({
      where: { id: payload.entry_id, store_id: event.store_id },
    });

    if (exists) {
      return; // Ya existe, idempotente
    }

    const soldAt = payload.sold_at
      ? new Date(payload.sold_at)
      : event.created_at;

    const entry = this.cashLedgerRepository.create({
      id: payload.entry_id,
      store_id: event.store_id,
      device_id: event.device_id,
      seq: event.seq,
      request_id: payload.request_id,
      entry_type: payload.entry_type,
      amount_bs: Number(payload.amount_bs) || 0,
      amount_usd: Number(payload.amount_usd) || 0,
      currency: payload.currency,
      cash_session_id: payload.cash_session_id,
      sold_at: soldAt,
      metadata: payload.metadata || undefined,
      vector_clock: event.vector_clock || {},
      event_id: event.event_id,
    });

    await this.cashLedgerRepository.save(entry);

    // 2. PN-Counter update for CashSession
    if (payload.cash_session_id) {
      const amountBs = Number(payload.amount_bs) || 0;
      const amountUsd = Number(payload.amount_usd) || 0;

      // Determinamos si es incremento (P) o decremento (N)
      // Tipos que suman (P): sale, income, initial_balance
      // Tipos que restan (N): expense
      // Tipos ambivalentes (adjustment, transfer): depende del signo

      let pBs = 0,
        nBs = 0,
        pUsd = 0,
        nUsd = 0;

      if (payload.entry_type === 'expense') {
        nBs = Math.abs(amountBs);
        nUsd = Math.abs(amountUsd);
      } else if (
        ['sale', 'income', 'initial_balance'].includes(payload.entry_type)
      ) {
        pBs = Math.abs(amountBs);
        pUsd = Math.abs(amountUsd);
      } else {
        // adjustment o transfer: usamos el signo
        if (amountBs > 0) pBs = amountBs;
        else nBs = Math.abs(amountBs);
        if (amountUsd > 0) pUsd = amountUsd;
        else nUsd = Math.abs(amountUsd);
      }

      await this.cashSessionRepository.manager
        .createQueryBuilder()
        .update(CashSession)
        .set({
          ledger_p_bs: () => `ledger_p_bs + ${pBs}`,
          ledger_n_bs: () => `ledger_n_bs + ${nBs}`,
          ledger_p_usd: () => `ledger_p_usd + ${pUsd}`,
          ledger_n_usd: () => `ledger_n_usd + ${nUsd}`,
        })
        .where('id = :id', { id: payload.cash_session_id })
        .execute();
    }
  }

  private async projectStockDeltaApplied(event: Event): Promise<void> {
    const payload = event.payload as unknown as StockDeltaAppliedPayload;
    if (!payload.movement_id) return;

    // Idempotency: Check if movement exists
    const exists = await this.movementRepository.findOne({
      where: { id: payload.movement_id, store_id: event.store_id },
    });

    if (exists) {
      return;
    }

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

    const warehouseId = await this.resolveWarehouseId(
      event.store_id,
      payload.warehouse_id || null,
    );

    const qtyDelta = Number(payload.qty_delta) || 0;

    const movement = this.movementRepository.create({
      id: payload.movement_id,
      store_id: event.store_id,
      product_id: payload.product_id,
      movement_type: 'adjust', // General type for delta
      qty_delta: qtyDelta,
      unit_cost_bs: Number(payload.unit_cost_bs) || 0,
      unit_cost_usd: Number(payload.unit_cost_usd) || 0,
      warehouse_id: warehouseId,
      note: payload.reason || 'Stock Delta Applied',
      ref: payload.ref || {
        request_id: payload.request_id,
        reason: payload.reason,
      },
      happened_at: event.created_at,
      from_escrow: !!payload.from_escrow,
    });

    await this.movementRepository.save(movement);

    if (payload.from_escrow) {
      // Si viene de escrow, restamos de la cuota del dispositivo
      const escrow = await this.stockEscrowRepository.findOne({
        where: {
          store_id: event.store_id,
          product_id: payload.product_id,
          device_id: event.device_id,
          variant_id: payload.variant_id || IsNull(),
        },
      });

      if (escrow) {
        escrow.qty_granted = Math.max(0, Number(escrow.qty_granted) + qtyDelta); // qtyDelta es negativo para ventas
        await this.stockEscrowRepository.save(escrow);
        this.logger.debug(
          `Escrow consumido para device ${event.device_id}: ${qtyDelta} (Nuevo: ${escrow.qty_granted})`,
        );
      } else {
        this.logger.warn(
          `Evento con from_escrow=true pero no se encontró cuota para device ${event.device_id} y producto ${payload.product_id}`,
        );
      }
    } else if (warehouseId) {
      // Si no es de escrow, restamos del stock central normal
      await this.warehousesService.updateStock(
        warehouseId,
        payload.product_id,
        payload.variant_id || null,
        qtyDelta,
        event.store_id,
      );
    }

    // Validación automática post-proyección
    await this.validateProductEscrowIntegrity(
      event.store_id,
      payload.product_id,
      payload.variant_id || null,
    );
  }

  private async projectStockQuotaGranted(event: Event): Promise<void> {
    const payload = event.payload as unknown as StockQuotaGrantedPayload;
    if (!payload.quota_id) return;

    const movementId = `grant-${payload.request_id || payload.quota_id}`;
    const exists = await this.movementRepository.findOne({
      where: { id: movementId, store_id: event.store_id },
    });
    if (exists) return;

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

    const qty = Number(payload.qty_granted) || 0;

    // Update Escrow
    const existingEscrow = await this.stockEscrowRepository.findOne({
      where: {
        store_id: event.store_id,
        product_id: payload.product_id,
        device_id: payload.device_id,
        variant_id: payload.variant_id || IsNull(),
      },
    });

    if (existingEscrow) {
      existingEscrow.qty_granted = Number(existingEscrow.qty_granted) + qty;
      if (payload.expires_at)
        existingEscrow.expires_at = new Date(payload.expires_at);
      await this.stockEscrowRepository.save(existingEscrow);
    } else {
      const escrow = this.stockEscrowRepository.create({
        id: payload.quota_id,
        store_id: event.store_id,
        product_id: payload.product_id,
        variant_id: payload.variant_id || null,
        device_id: payload.device_id,
        qty_granted: qty,
        expires_at: payload.expires_at
          ? new Date(payload.expires_at)
          : undefined,
      });
      await this.stockEscrowRepository.save(escrow);
    }

    // Subtract from warehouse
    const warehouseId = await this.resolveWarehouseId(event.store_id, null);
    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        payload.product_id,
        payload.variant_id || null,
        -qty, // Grant REMOVES from available warehouse stock
        event.store_id,
      );

      const movement = this.movementRepository.create({
        id: movementId,
        store_id: event.store_id,
        product_id: payload.product_id,
        variant_id: payload.variant_id || null,
        movement_type: 'transfer_out',
        qty_delta: -qty,
        unit_cost_bs: 0,
        unit_cost_usd: 0,
        warehouse_id: warehouseId,
        note: `Escrow Grant to device ${payload.device_id}`,
        ref: { request_id: payload.request_id, quota_id: payload.quota_id },
        happened_at: event.created_at,
      });
      await this.movementRepository.save(movement);
    }
  }

  private async projectStockQuotaTransferred(event: Event): Promise<void> {
    const payload = event.payload as unknown as StockQuotaTransferredPayload;
    if (!payload.request_id) return;

    const movementId = `transfer-${payload.request_id}`;
    const exists = await this.movementRepository.findOne({
      where: { id: movementId, store_id: event.store_id },
    });
    if (exists) return;

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

    const qty = Number(payload.qty) || 0;

    // From Device
    const fromEscrow = await this.stockEscrowRepository.findOne({
      where: {
        store_id: event.store_id,
        product_id: payload.product_id,
        device_id: payload.from_device_id,
        variant_id: payload.variant_id || IsNull(),
      },
    });
    if (fromEscrow) {
      fromEscrow.qty_granted = Math.max(
        0,
        Number(fromEscrow.qty_granted) - qty,
      );
      await this.stockEscrowRepository.save(fromEscrow);
    }

    // To Device
    const toEscrow = await this.stockEscrowRepository.findOne({
      where: {
        store_id: event.store_id,
        product_id: payload.product_id,
        device_id: payload.to_device_id,
        variant_id: payload.variant_id || IsNull(),
      },
    });
    if (toEscrow) {
      toEscrow.qty_granted = Number(toEscrow.qty_granted) + qty;
      await this.stockEscrowRepository.save(toEscrow);
    } else {
      const escrow = this.stockEscrowRepository.create({
        id: randomUUID(),
        store_id: event.store_id,
        product_id: payload.product_id,
        variant_id: payload.variant_id || null,
        device_id: payload.to_device_id,
        qty_granted: qty,
      });
      await this.stockEscrowRepository.save(escrow);
    }

    const movement = this.movementRepository.create({
      id: movementId,
      store_id: event.store_id,
      product_id: payload.product_id,
      variant_id: payload.variant_id || null,
      movement_type: 'transfer_out',
      qty_delta: 0,
      unit_cost_bs: 0,
      unit_cost_usd: 0,
      warehouse_id: null,
      note: `Escrow Transfer ${payload.from_device_id} -> ${payload.to_device_id}`,
      ref: {
        request_id: payload.request_id,
        from: payload.from_device_id,
        to: payload.to_device_id,
      },
      happened_at: event.created_at,
    });
    await this.movementRepository.save(movement);
  }

  private async projectStockQuotaReclaimed(event: Event): Promise<void> {
    const payload = event.payload as unknown as StockQuotaReclaimedPayload;
    if (!payload.request_id) return;

    const movementId = `reclaim-${payload.request_id}`;
    const exists = await this.movementRepository.findOne({
      where: { id: movementId, store_id: event.store_id },
    });
    if (exists) return;

    await this.ensureProductExists(
      event.store_id,
      payload.product_id,
      event.event_id,
    );

    const qty = Number(payload.qty_reclaimed) || 0;

    // 1. Zerear/Actualizar Escrow
    const escrow = await this.stockEscrowRepository.findOne({
      where: {
        store_id: event.store_id,
        product_id: payload.product_id,
        device_id: payload.device_id,
        variant_id: payload.variant_id || IsNull(),
      },
    });

    if (escrow) {
      escrow.qty_granted = Math.max(0, Number(escrow.qty_granted) - qty);
      await this.stockEscrowRepository.save(escrow);
      this.logger.debug(
        `Escrow reclamado para device ${payload.device_id}: ${qty} (Nuevo: ${escrow.qty_granted})`,
      );
    }

    // 2. Devolver stock al almacén central
    const warehouseId = await this.resolveWarehouseId(event.store_id, null);
    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        payload.product_id,
        payload.variant_id || null,
        qty, // Reclaim ADDS back to warehouse stock
        event.store_id,
      );

      const movement = this.movementRepository.create({
        id: movementId,
        store_id: event.store_id,
        product_id: payload.product_id,
        variant_id: payload.variant_id || null,
        movement_type: 'transfer_in',
        qty_delta: qty,
        unit_cost_bs: 0,
        unit_cost_usd: 0,
        warehouse_id: warehouseId,
        note: payload.reason || `Escrow Reclaimed from ${payload.device_id}`,
        ref: { request_id: payload.request_id, device_id: payload.device_id },
        happened_at: event.created_at,
      });
      await this.movementRepository.save(movement);
    }

    // 3. Validar integridad post-reclaim
    await this.validateProductEscrowIntegrity(
      event.store_id,
      payload.product_id,
      payload.variant_id || null,
    );
  }

  /**
   * Valida la integridad del stock de un producto considerando el escrow y los almacenes.
   * La suma de (Central Warehouse Stock + SUM(Escrow en todos los devices)) debe coincidir
   * con el balance total derivado del ledger de movimientos.
   */
  async validateProductEscrowIntegrity(
    storeId: string,
    productId: string,
    variantId: string | null = null,
  ): Promise<{
    integrityOk: boolean;
    discrepancy: number;
    details: any;
  }> {
    // 1. Suma de movimientos (Ledger de Verdad)
    const movementSum = await this.movementRepository
      .createQueryBuilder('m')
      .select('SUM(m.qty_delta)', 'total')
      .where('m.store_id = :storeId', { storeId })
      .andWhere('m.product_id = :productId', { productId })
      .andWhere(
        variantId ? 'm.variant_id = :variantId' : 'm.variant_id IS NULL',
        { variantId },
      )
      .getRawOne();

    const ledgerTotal = Number(movementSum?.total || 0);

    // 2. Stock en almacenes físicos (total de la tienda)
    const physicalStock = await this.warehousesService.getTotalStockQuantity(
      storeId,
      productId,
      variantId,
    );

    // 3. Stock en Escrow (bloqueado en dispositivos)
    const escrowSum = await this.stockEscrowRepository
      .createQueryBuilder('e')
      .select('SUM(e.qty_granted)', 'total')
      .where('e.store_id = :storeId', { storeId })
      .andWhere('e.product_id = :productId', { productId })
      .andWhere(
        variantId ? 'e.variant_id = :variantId' : 'e.variant_id IS NULL',
        { variantId },
      )
      .getRawOne();

    const escrowTotal = Number(escrowSum?.total || 0);

    // 4. Verificación
    const calculatedTotal = physicalStock + escrowTotal;
    const discrepancy = calculatedTotal - ledgerTotal;
    const integrityOk = Math.abs(discrepancy) < 0.001;

    const details = {
      ledgerTotal,
      physicalStock,
      escrowTotal,
      calculatedTotal,
      discrepancy,
    };

    if (!integrityOk) {
      this.logger.error(
        `🚨 Discrepancia de Escrow detectada: Store ${storeId}, Product ${productId}. Ledger: ${ledgerTotal}, Central+Escrow: ${calculatedTotal}`,
      );
    }

    return { integrityOk, discrepancy, details };
  }

  private async projectSaleVoided(event: Event): Promise<void> {
    const payload = event.payload as unknown as SaleVoidedPayload;
    const sale = await this.saleRepository.findOne({
      where: { id: payload.sale_id, store_id: event.store_id },
      relations: ['items'],
    });

    if (!sale) {
      this.logger.warn(`Venta ${payload.sale_id} no encontrada para anular.`);
      return;
    }

    if (sale.voided_at) {
      return; // Ya anulada
    }

    await this.dataSource.transaction(async (manager) => {
      const now = payload.voided_at
        ? new Date(payload.voided_at)
        : event.created_at;

      sale.voided_at = now;
      sale.voided_by_user_id = payload.voided_by_user_id;
      sale.void_reason = payload.reason || null;
      await manager.save(Sale, sale);

      // Revertir stock si hay items
      if (sale.items && sale.items.length > 0) {
        const stockUpdates: Array<{
          product_id: string;
          variant_id: string | null;
          qty_delta: number;
        }> = [];

        // Buscar almacén (warehouse_id) de los movimientos originales
        const originalMovements = await manager
          .getRepository(InventoryMovement)
          .createQueryBuilder('im')
          .where("im.ref->>'sale_id' = :saleId", { saleId: sale.id })
          .andWhere("im.movement_type = 'sold'")
          .getMany();

        const warehouseByItem = new Map<string, string | null>();
        for (const m of originalMovements) {
          const key = `${m.product_id}:${m.variant_id || 'null'}`;
          if (!warehouseByItem.has(key)) {
            warehouseByItem.set(key, m.warehouse_id || null);
          }
        }

        const movements: InventoryMovement[] = [];
        for (const item of sale.items) {
          const key = `${item.product_id}:${item.variant_id || 'null'}`;
          const warehouseId = warehouseByItem.get(key) || null;

          movements.push(
            manager.getRepository(InventoryMovement).create({
              id: randomUUID(),
              store_id: event.store_id,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              movement_type: 'adjust',
              qty_delta: Number(item.qty), // Positivo para devolver
              unit_cost_bs: 0,
              unit_cost_usd: 0,
              warehouse_id: warehouseId,
              note: `Anulación venta ${sale.id}`,
              ref: {
                sale_id: sale.id,
                reversal: true,
                warehouse_id: warehouseId,
              },
              happened_at: now,
              approved: true,
            }),
          );

          if (warehouseId) {
            stockUpdates.push({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              qty_delta: Number(item.qty),
            });
          }
        }

        if (movements.length > 0) {
          await manager.save(InventoryMovement, movements);
        }

        if (stockUpdates.length > 0) {
          // Agrupar por almacén para actualizaciones por lote
          const updatesByWarehouse = new Map<string, typeof stockUpdates>();
          for (const update of stockUpdates) {
            const itemKey = `${update.product_id}:${update.variant_id || 'null'}`;
            const wId = warehouseByItem.get(itemKey);
            if (wId) {
              if (!updatesByWarehouse.has(wId)) {
                updatesByWarehouse.set(wId, []);
              }
              updatesByWarehouse.get(wId)!.push(update);
            }
          }

          for (const [wId, updates] of updatesByWarehouse.entries()) {
            await this.warehousesService.updateStockBatch(
              wId,
              updates,
              event.store_id,
              manager,
            );
          }
        }
      }

      // ELIMINAR DEUDA SI EXISTE
      const debt = await manager.getRepository(Debt).findOne({
        where: { sale_id: sale.id, store_id: event.store_id },
      });
      if (debt) {
        await manager.getRepository(DebtPayment).delete({ debt_id: debt.id });
        await manager.getRepository(Debt).delete({ id: debt.id });
      }
    });

    this.logger.log(`Venta ${payload.sale_id} anulada por proyección.`);
  }

  /**
   * healFailedProjections - Re-proyecta eventos que fallaron anteriormente
   *
   * Esto soluciona el bug donde eventos (ej: DebtCreated) no se proyectaban correctamente
   * y quedaban con projection_status='failed' o sin proyección.
   *
   * @param storeId - Opcional, filtrar por tienda
   * @param limit - Máximo número de eventos a procesar (default: 100)
   * @returns Estadísticas de eventos curados
   */
  async healFailedProjections(
    storeId?: string,
    limit = 100,
  ): Promise<{
    processed: number;
    healed: number;
    stillFailing: number;
    errors: Array<{ eventId: string; type: string; error: string }>;
  }> {
    this.logger.log(
      `🔧 Iniciando heal de proyecciones fallidas${storeId ? ` para store ${storeId}` : ''}...`,
    );

    // Buscar eventos con projection_status = 'failed' o NULL (nunca proyectados)
    let query = this.dataSource
      .getRepository(Event)
      .createQueryBuilder('e')
      .where("(e.projection_status = 'failed' OR e.projection_status IS NULL)")
      .orderBy('e.created_at', 'ASC')
      .limit(limit);

    if (storeId) {
      query = query.andWhere('e.store_id = :storeId', { storeId });
    }

    const failedEvents = await query.getMany();

    if (failedEvents.length === 0) {
      this.logger.log('✅ No hay proyecciones fallidas para curar.');
      return { processed: 0, healed: 0, stillFailing: 0, errors: [] };
    }

    this.logger.log(`Encontrados ${failedEvents.length} eventos para curar.`);

    let healed = 0;
    let stillFailing = 0;
    const errors: Array<{ eventId: string; type: string; error: string }> = [];

    for (const event of failedEvents) {
      try {
        await this.projectEvent(event);

        // Marcar como curado
        await this.dataSource.getRepository(Event).update(event.event_id, {
          projection_status: 'processed',
          projection_error: null,
        });

        healed++;
        this.logger.debug(`✅ Curado: ${event.type} (${event.event_id})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stillFailing++;
        errors.push({
          eventId: event.event_id,
          type: event.type,
          error: errorMsg,
        });

        // Actualizar error message
        await this.dataSource.getRepository(Event).update(event.event_id, {
          projection_status: 'failed',
          projection_error: errorMsg,
        });

        this.logger.warn(
          `❌ Sigue fallando: ${event.type} (${event.event_id}): ${errorMsg}`,
        );
      }
    }

    this.logger.log(
      `🔧 Heal completado: ${healed} curados, ${stillFailing} siguen fallando de ${failedEvents.length} procesados.`,
    );

    return {
      processed: failedEvents.length,
      healed,
      stillFailing,
      errors,
    };
  }
}
