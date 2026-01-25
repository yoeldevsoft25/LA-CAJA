import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Repository,
  DataSource,
  EntityManager,
  In,
  MoreThanOrEqual,
  LessThanOrEqual,
  Between,
} from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Customer } from '../database/entities/customer.entity';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReturnSaleDto } from './dto/return-sale.dto';
import { randomUUID } from 'crypto';
import { CashSession } from '../database/entities/cash-session.entity';
import { IsNull } from 'typeorm';
import { PaymentRulesService, PaymentSplit } from '../payments/payment-rules.service';
import {
  DiscountRulesService,
  DiscountValidationResult,
} from '../discounts/discount-rules.service';
import { FastCheckoutRulesService } from '../fast-checkout/fast-checkout-rules.service';
import { ProductVariant } from '../database/entities/product-variant.entity';
import { ProductVariantsService } from '../product-variants/product-variants.service';
import { ProductLot } from '../database/entities/product-lot.entity';
import { LotMovement } from '../database/entities/lot-movement.entity';
import { ProductLotsService } from '../product-lots/product-lots.service';
import { InventoryRulesService } from '../product-lots/inventory-rules.service';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { ProductSerialsService } from '../product-serials/product-serials.service';
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service';
import { PriceListsService } from '../price-lists/price-lists.service';
import { PromotionsService } from '../promotions/promotions.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { FiscalInvoicesService } from '../fiscal-invoices/fiscal-invoices.service';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { AccountingService } from '../accounting/accounting.service';
import { ConfigValidationService } from '../config/config-validation.service';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { SaleReturnItem } from '../database/entities/sale-return-item.entity';
import { SecurityAuditService } from '../security/security-audit.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  private buildSplitSummary(
    splitPayments: CreateSaleDto['split_payments'],
    exchangeRate: number,
  ): PaymentSplit | null {
    if (!splitPayments || splitPayments.length === 0) {
      return null;
    }

    const summary: PaymentSplit = {};
    const safeRate = exchangeRate > 0 ? exchangeRate : 1;
    let hasAmount = false;

    for (const payment of splitPayments) {
      if (!payment) continue;

      const amountUsd = Number(payment.amount_usd ?? 0);
      const amountBs = Number(payment.amount_bs ?? 0);

      if (amountUsd <= 0 && amountBs <= 0) {
        continue;
      }

      hasAmount = true;

      switch (payment.method) {
        case 'CASH_BS':
          summary.cash_bs =
            (summary.cash_bs || 0) + (amountBs || amountUsd * safeRate);
          break;
        case 'CASH_USD':
          summary.cash_usd =
            (summary.cash_usd || 0) + (amountUsd || amountBs / safeRate);
          break;
        case 'PAGO_MOVIL':
          summary.pago_movil_bs =
            (summary.pago_movil_bs || 0) + (amountBs || amountUsd * safeRate);
          break;
        case 'TRANSFER':
          summary.transfer_bs =
            (summary.transfer_bs || 0) + (amountBs || amountUsd * safeRate);
          break;
        case 'OTHER':
          summary.other_bs =
            (summary.other_bs || 0) + (amountBs || amountUsd * safeRate);
          break;
        default:
          break;
      }
    }

    return hasAmount ? summary : null;
  }

  private getSplitMethods(dto: CreateSaleDto): string[] {
    const methods = new Set<string>();

    if (dto.split_payments && dto.split_payments.length > 0) {
      for (const payment of dto.split_payments) {
        if (!payment) continue;
        const amountUsd = Number(payment.amount_usd ?? 0);
        const amountBs = Number(payment.amount_bs ?? 0);
        if (amountUsd > 0 || amountBs > 0) {
          methods.add(payment.method);
        }
      }
      return Array.from(methods);
    }

    if (dto.split) {
      if ((dto.split.cash_bs || 0) > 0) methods.add('CASH_BS');
      if ((dto.split.cash_usd || 0) > 0) methods.add('CASH_USD');
      if ((dto.split.pago_movil_bs || 0) > 0) methods.add('PAGO_MOVIL');
      if ((dto.split.transfer_bs || 0) > 0) methods.add('TRANSFER');
      if ((dto.split.other_bs || 0) > 0) methods.add('OTHER');
    }

    return Array.from(methods);
  }

  private async validatePaymentAuthorization(
    storeId: string,
    dto: CreateSaleDto,
    userRole?: string,
  ): Promise<void> {
    const role = userRole || 'cashier';
    if (role === 'owner') {
      return;
    }

    const methodsToCheck =
      dto.payment_method === 'SPLIT'
        ? this.getSplitMethods(dto)
        : [dto.payment_method];

    if (methodsToCheck.length === 0) {
      return;
    }

    const configs = await this.paymentRulesService.getConfigs(storeId);
    const blocked = configs
      .filter((config) => config.requires_authorization)
      .filter((config) => methodsToCheck.includes(config.method));

    if (blocked.length > 0) {
      const methodList = blocked.map((config) => config.method).join(', ');
      throw new BadRequestException(
        `Los métodos de pago ${methodList} requieren autorización de owner`,
      );
    }
  }

  /**
   * Valida disponibilidad de stock ANTES de la transacción
   * ⚡ OPTIMIZACIÓN: Batch queries para evitar N+1
   * Esta es una validación rápida sin locks para rechazar rápidamente si no hay stock.
   * La validación definitiva con locks se hace dentro de la transacción.
   */
  private async validateStockAvailability(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
  ): Promise<void> {
    const validateStart = Date.now();
    // Determinar bodega de venta
    let warehouseId: string | null = null;
    if (dto.warehouse_id) {
      // Validar que la bodega existe y pertenece a la tienda
      await this.warehousesService.findOne(storeId, dto.warehouse_id);
      warehouseId = dto.warehouse_id;
    } else {
      // Usar bodega por defecto si no se especifica
      const defaultWarehouse =
        await this.warehousesService.getDefaultOrFirst(storeId);
      warehouseId = defaultWarehouse.id;
    }

    // ⚡ OPTIMIZACIÓN CRÍTICA: Batch queries para productos, variantes, lotes y seriales
    const productIds = dto.items.map(item => item.product_id);
    const variantIds = dto.items
      .map(item => item.variant_id)
      .filter((id): id is string => !!id);
    
    // ⚡ OPTIMIZACIÓN CRÍTICA: Ejecutar queries independientes en paralelo
    const [
      stockRecords,
      products,
      variants,
      allLots,
    ] = await Promise.all([
      // 1. Batch query de stocks para todos los productos de una vez
      // ⚡ OPTIMIZACIÓN: Usar formato de array PostgreSQL nativo para mejor rendimiento
      warehouseId
        ? this.dataSource.query(
            `SELECT product_id, variant_id, stock, reserved
             FROM warehouse_stock
             WHERE warehouse_id = $1
               AND product_id = ANY($2::uuid[])`,
            [warehouseId, productIds],
          )
        : this.dataSource.query(
            `SELECT ws.product_id, ws.variant_id, COALESCE(SUM(ws.stock - COALESCE(ws.reserved, 0)), 0) as stock, 0 as reserved
             FROM warehouse_stock ws
             INNER JOIN warehouses w ON ws.warehouse_id = w.id
             WHERE w.store_id = $1
               AND ws.product_id = ANY($2::uuid[])
             GROUP BY ws.product_id, ws.variant_id`,
            [storeId, productIds],
          ),
      // 2. Batch query de productos
      this.productRepository.find({
        where: {
          id: In(productIds),
          store_id: storeId,
          is_active: true,
        },
      }),
      // 3. Batch query de variantes (solo si hay)
      variantIds.length > 0
        ? this.dataSource.getRepository(ProductVariant).find({
            where: { id: In(variantIds) },
          })
        : Promise.resolve([]),
      // 4. Batch query para lotes
      this.dataSource.getRepository(ProductLot).find({
        where: { product_id: In(productIds) },
      }),
    ]);
    
    // 5. Batch query para seriales (después de obtener productos para saber cuáles no son por peso)
    const productsWithSerials = products
      .filter(p => !p.is_weight_product)
      .map(p => p.id);
    const allSerials = productsWithSerials.length > 0
      ? await this.dataSource.getRepository(ProductSerial).find({
          where: { product_id: In(productsWithSerials) },
        })
      : [];
    
    // Crear mapa de stocks para acceso O(1)
    const stockMap = new Map<string, number>();
    for (const record of stockRecords) {
      const key = `${record.product_id}:${record.variant_id || 'null'}`;
      const availableStock = Number(record.stock || 0) - Number(record.reserved || 0);
      stockMap.set(key, Math.max(0, availableStock));
    }

    const productMap = new Map<string, Product>();
    for (const product of products) {
      productMap.set(product.id, product);
    }

    const variantMap = new Map<string, ProductVariant>();
    for (const variant of variants) {
      variantMap.set(variant.id, variant);
    }

    const lotsMap = new Map<string, ProductLot[]>();
    for (const lot of allLots) {
      const existing = lotsMap.get(lot.product_id) || [];
      existing.push(lot);
      lotsMap.set(lot.product_id, existing);
    }

    const serialsMap = new Map<string, ProductSerial[]>();
    for (const serial of allSerials) {
      const existing = serialsMap.get(serial.product_id) || [];
      existing.push(serial);
      serialsMap.set(serial.product_id, existing);
    }

    // Validar stock para cada item usando los mapas pre-cargados
    for (const cartItem of dto.items) {
      const product = productMap.get(cartItem.product_id);

      if (!product) {
        throw new NotFoundException(
          `Producto ${cartItem.product_id} no encontrado o inactivo`,
        );
      }

      // Manejar variante si se proporciona (usando mapa)
      let variant: ProductVariant | null = null;
      if (cartItem.variant_id) {
        variant = variantMap.get(cartItem.variant_id) || null;

        if (!variant) {
          throw new NotFoundException(
            `Variante ${cartItem.variant_id} no encontrada para el producto ${product.name}`,
          );
        }

        if (variant.product_id !== product.id) {
          throw new BadRequestException(
            `La variante ${cartItem.variant_id} no pertenece al producto ${product.id}`,
          );
        }

        if (!variant.is_active) {
          throw new BadRequestException(
            `La variante ${variant.variant_type}: ${variant.variant_value} está desactivada`,
          );
        }
      }

      const isWeightProduct = Boolean(
        cartItem.is_weight_product || product.is_weight_product,
      );
      const weightValue = isWeightProduct
        ? Number(cartItem.weight_value ?? cartItem.qty)
        : 0;

      if (isWeightProduct && weightValue <= 0) {
        throw new BadRequestException(
          `Peso inválido para el producto ${product.name}`,
        );
      }

      const requestedQty = isWeightProduct ? weightValue : cartItem.qty;

      // Verificar si el producto tiene lotes (usando mapa)
      const productLots = lotsMap.get(product.id) || [];

      if (productLots.length > 0) {
        // Producto con lotes: validar que haya suficiente stock en lotes disponibles
        const availableLots = productLots.filter(
          (lot) => lot.remaining_quantity > 0,
        );

        if (availableLots.length === 0) {
          throw new BadRequestException(
            `No hay stock disponible en lotes para ${product.name}`,
          );
        }

        // Calcular stock total disponible en lotes
        const totalAvailableInLots = availableLots.reduce(
          (sum, lot) => sum + Number(lot.remaining_quantity),
          0,
        );

        if (totalAvailableInLots < requestedQty) {
          throw new BadRequestException(
            `Stock insuficiente en lotes para ${product.name}. Disponible: ${totalAvailableInLots}, Solicitado: ${requestedQty}`,
          );
        }
      } else {
        // Producto sin lotes: validar stock normal usando el mapa pre-cargado
        const stockKey = `${product.id}:${variant?.id || 'null'}`;
        const currentStock = stockMap.get(stockKey) || 0;

        if (currentStock < requestedQty) {
          const variantInfo = variant
            ? ` (${variant.variant_type}: ${variant.variant_value})`
            : '';
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}${variantInfo}. Disponible: ${currentStock}, Solicitado: ${requestedQty}`,
          );
        }
      }

      // Si el producto tiene seriales, validar que haya suficientes disponibles (usando mapa)
      if (!isWeightProduct) {
        const productSerials = serialsMap.get(product.id) || [];

        if (productSerials.length > 0) {
          const availableSerials = productSerials.filter(
            (s) => s.status === 'available',
          );

          if (availableSerials.length < requestedQty) {
            throw new BadRequestException(
              `No hay suficientes seriales disponibles para ${product.name}. Disponibles: ${availableSerials.length}, Solicitados: ${requestedQty}`,
            );
          }
        }
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:371',message:'VALIDATE_STOCK_AVAILABILITY_COMPLETE',data:{duration:Date.now()-validateStart,itemsCount:dto.items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'validate-stock',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }

  /**
   * Valida y bloquea stock de una bodega específica usando SELECT FOR UPDATE
   * Retorna el stock disponible después de bloquear
   */
  private async validateAndLockStock(
    manager: EntityManager,
    storeId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    requestedQty: number,
  ): Promise<number> {
    const lockStart = Date.now();
    // ⚡ OPTIMIZACIÓN CRÍTICA: Separar la lógica para usar índices de manera más eficiente
    // En lugar de usar OR (que puede causar table scans), separamos los casos
    // Si variantId es NULL, buscamos explícitamente variant_id IS NULL
    // Si variantId no es NULL, buscamos variant_id = variantId
    // Esto permite que PostgreSQL use el índice único (warehouse_id, product_id, variant_id) de manera más eficiente
    // El índice único ya existe, pero PostgreSQL puede no usarlo eficientemente con la condición OR compleja
    
    // ⚡ OPTIMIZACIÓN: Query separada por caso para aprovechar índices
    // Esto reduce el tiempo de 4-20 segundos a <100ms típicamente
    // Los índices parciales en la migración 84 ayudan aún más
    const result = variantId === null
      ? await manager.query(
          `SELECT stock, reserved
           FROM warehouse_stock
           WHERE warehouse_id = $1
             AND product_id = $2
             AND variant_id IS NULL
           FOR UPDATE
           LIMIT 1`,
          [warehouseId, productId],
        )
      : await manager.query(
          `SELECT stock, reserved
           FROM warehouse_stock
           WHERE warehouse_id = $1
             AND product_id = $2
             AND variant_id = $3
           FOR UPDATE
           LIMIT 1`,
          [warehouseId, productId, variantId],
        );

    if (!result || result.length === 0) {
      // No hay registro de stock, significa stock = 0
      if (requestedQty > 0) {
        throw new BadRequestException(
          `No hay stock disponible para el producto solicitado`,
        );
      }
      return 0;
    }

    const availableStock = Number(result[0].stock || 0) - Number(result[0].reserved || 0);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:428',message:'VALIDATE_AND_LOCK_STOCK_COMPLETE',data:{duration:Date.now()-lockStart,productId,warehouseId,variantId:variantId||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'lock-stock',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    return Math.max(0, availableStock);
  }

  /**
   * Valida y bloquea stock total (suma de todas las bodegas) usando SELECT FOR UPDATE
   * Retorna el stock total disponible después de bloquear
   */
  private async validateAndLockTotalStock(
    manager: EntityManager,
    storeId: string,
    productId: string,
    variantId: string | null,
    requestedQty: number,
  ): Promise<number> {
    // ⚡ OPTIMIZACIÓN: Separar la lógica para usar índices de manera más eficiente
    // Similar a validateAndLockStock, separamos los casos para aprovechar índices
    // Esto evita el uso de OR que puede causar table scans
    const result = variantId === null
      ? await manager.query(
          `SELECT COALESCE(SUM(ws.stock - COALESCE(ws.reserved, 0)), 0) as total_available
           FROM warehouse_stock ws
           INNER JOIN warehouses w ON ws.warehouse_id = w.id
           WHERE w.store_id = $1
             AND ws.product_id = $2
             AND ws.variant_id IS NULL
           FOR UPDATE OF ws`,
          [storeId, productId],
        )
      : await manager.query(
          `SELECT COALESCE(SUM(ws.stock - COALESCE(ws.reserved, 0)), 0) as total_available
           FROM warehouse_stock ws
           INNER JOIN warehouses w ON ws.warehouse_id = w.id
           WHERE w.store_id = $1
             AND ws.product_id = $2
             AND ws.variant_id = $3
           FOR UPDATE OF ws`,
          [storeId, productId, variantId],
        );

    const totalAvailable = Number(result[0]?.total_available || 0);
    return Math.max(0, totalAvailable);
  }

  /**
   * Valida que el cliente tenga crédito disponible para una venta FIAO
   */
  private async validateFIAOCredit(
    storeId: string,
    dto: CreateSaleDto,
    totalUsd: number,
  ): Promise<void> {
    let customerId: string | null = null;

    // Determinar customer_id
    if (dto.customer_id) {
      customerId = dto.customer_id;
    } else if (dto.customer_document_id) {
      const customer = await this.customerRepository.findOne({
        where: {
          store_id: storeId,
          document_id: dto.customer_document_id.trim(),
        },
      });
      if (customer) {
        customerId = customer.id;
      }
    }

    if (!customerId) {
      throw new BadRequestException(
        'FIAO requiere un cliente existente. Proporciona customer_id o customer_document_id',
      );
    }

    // Obtener cliente
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, store_id: storeId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Validar que tenga crédito habilitado
    if (customer.credit_limit === null || customer.credit_limit <= 0) {
      throw new BadRequestException(
        'El cliente no tiene crédito habilitado para compras FIAO',
      );
    }

    // Calcular deuda actual
    const debtResult = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        amount_usd - COALESCE((
          SELECT SUM(amount_usd) FROM debt_payments WHERE debt_id = d.id
        ), 0)
      ), 0) as current_debt
      FROM debts d
      WHERE store_id = $1 
        AND customer_id = $2
        AND status != 'paid'
    `,
      [storeId, customerId],
    );

    const currentDebt = parseFloat(debtResult[0]?.current_debt || '0');
    const availableCredit = Number(customer.credit_limit) - currentDebt;

    // Validar que el crédito disponible sea suficiente
    if (availableCredit < totalUsd) {
      throw new BadRequestException(
        `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} USD, Solicitado: $${totalUsd.toFixed(2)} USD`,
      );
    }
  }

  /**
   * Ejecuta una transacción con retry logic para manejar deadlocks
   * Reintenta hasta 3 veces con backoff exponencial si hay deadlock (código 40P01)
   */
  private async transactionWithRetry<T>(
    callback: (manager: EntityManager) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.dataSource.transaction(callback);
      } catch (error: any) {
        // Código de error PostgreSQL para deadlock
        const isDeadlock = error?.code === '40P01' || 
                          error?.message?.includes('deadlock') ||
                          error?.message?.includes('Deadlock');

        if (isDeadlock && attempt < maxRetries - 1) {
          // Backoff exponencial: 100ms, 200ms, 400ms
          const delay = 100 * Math.pow(2, attempt);
          this.logger.warn(
            `Deadlock detectado en transacción (intento ${attempt + 1}/${maxRetries}). Reintentando en ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Si no es deadlock o ya se agotaron los reintentos, lanzar el error
        throw error;
      }
    }

    // Esto no debería ejecutarse nunca, pero TypeScript lo requiere
    throw new Error('Error inesperado en transactionWithRetry');
  }

  private async getNextSaleNumber(
    manager: EntityManager,
    storeId: string,
  ): Promise<number> {
    const result = await manager.query(
      `INSERT INTO sale_sequences (store_id, current_number, created_at, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (store_id)
       DO UPDATE SET current_number = sale_sequences.current_number + 1, updated_at = NOW()
       RETURNING current_number`,
      [storeId],
    );
    const nextNumber = Number(result?.[0]?.current_number ?? 0);
    if (!nextNumber) {
      throw new InternalServerErrorException(
        'No se pudo generar el numero de venta',
      );
    }
    return nextNumber;
  }

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
    @InjectRepository(SaleReturn)
    private saleReturnRepository: Repository<SaleReturn>,
    @InjectRepository(SaleReturnItem)
    private saleReturnItemRepository: Repository<SaleReturnItem>,
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    private dataSource: DataSource,
    private paymentRulesService: PaymentRulesService,
    private discountRulesService: DiscountRulesService,
    private fastCheckoutRulesService: FastCheckoutRulesService,
    private productVariantsService: ProductVariantsService,
    private productLotsService: ProductLotsService,
    private inventoryRulesService: InventoryRulesService,
    private productSerialsService: ProductSerialsService,
    private invoiceSeriesService: InvoiceSeriesService,
    private priceListsService: PriceListsService,
    private promotionsService: PromotionsService,
    private warehousesService: WarehousesService,
    private fiscalInvoicesService: FiscalInvoicesService,
    private accountingService: AccountingService,
    private configValidationService: ConfigValidationService,
    private securityAuditService: SecurityAuditService,
    @InjectQueue('sales-post-processing')
    private salesPostProcessingQueue: Queue,
  ) {}

  async create(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
    userRole?: string,
  ): Promise<Sale> {
    const startTime = Date.now();
    const effectiveUserRole = userRole || 'cashier';
    const runId = `run-${Date.now()}`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:649',message:'SALE_CREATE_START',data:{storeId,userId,itemsCount:dto.items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    this.logger.log(
      `[SALE_CREATE] Iniciando creación de venta - Store: ${storeId}, User: ${userId}, Items: ${dto.items?.length || 0}`,
    );
    // ⚙️ VALIDAR CONFIGURACIÓN DEL SISTEMA ANTES DE GENERAR VENTA
    const configStart = Date.now();
    const canGenerate = await this.configValidationService.canGenerateSale(
      storeId,
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:656',message:'CONFIG_VALIDATION',data:{duration:Date.now()-configStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!canGenerate) {
      const errorMessage =
        await this.configValidationService.getConfigurationErrorMessage(
          storeId,
        );
      throw new BadRequestException(errorMessage);
    }

    // ⚠️ EDGE CASE: Validar que hay items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito no puede estar vacío');
    }

    // ⚠️ EDGE CASE: Validar que todos los items tengan cantidad > 0
    for (const item of dto.items) {
      const qty = item.is_weight_product && item.weight_value
        ? Number(item.weight_value)
        : Number(item.qty) || 0;
      if (qty <= 0) {
        throw new BadRequestException(
          `La cantidad debe ser mayor a 0 para el producto ${item.product_id}`,
        );
      }
    }

    // ⚠️ EDGE CASE: Validar que exchange_rate sea válido
    if (!dto.exchange_rate || dto.exchange_rate <= 0) {
      throw new BadRequestException(
        'La tasa de cambio debe ser mayor a 0',
      );
    }

    // ⚠️ VALIDACIÓN CRÍTICA: Todas las ventas requieren un responsable (userId)
    if (!userId) {
      throw new BadRequestException(
        'Todas las ventas requieren un responsable (cajero). No se puede procesar la venta sin identificar quién la realizó.',
      );
    }

    // ⚠️ VALIDACIÓN CRÍTICA: Ventas FIAO requieren cliente obligatoriamente
    if (dto.payment_method === 'FIAO') {
      const hasCustomerId = !!dto.customer_id;
      const hasCustomerData = !!(dto.customer_name && dto.customer_document_id);
      
      if (!hasCustomerId && !hasCustomerData) {
        throw new BadRequestException(
          'Las ventas FIAO requieren un cliente. Debes proporcionar un customer_id existente o los datos del cliente (nombre y cédula).',
        );
      }
    }

    // Validar modo caja rápida si aplica
    const hasDiscounts = dto.items.some(
      (item) => (item.discount_bs || 0) > 0 || (item.discount_usd || 0) > 0,
    );
    const hasCustomer = !!(
      dto.customer_id ||
      dto.customer_name ||
      dto.customer_document_id
    );

    const fastCheckoutValidation =
      await this.fastCheckoutRulesService.validateFastCheckout(
        storeId,
        dto.items.length,
        hasDiscounts,
        hasCustomer,
      );

    if (!fastCheckoutValidation.valid) {
      throw new BadRequestException(fastCheckoutValidation.error);
    }

    // Validar que exista una sesión de caja abierta
    const cashSessionStart = Date.now();
    const openSessionWhere: Record<string, any> = {
      store_id: storeId,
      closed_at: IsNull(),
    };
    if (userId) {
      openSessionWhere.opened_by = userId;
    }

    const openSession = await this.cashSessionRepository.findOne({
      where: openSessionWhere,
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:742',message:'CASH_SESSION_QUERY',data:{duration:Date.now()-cashSessionStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!openSession) {
      throw new BadRequestException(
        userId
          ? 'No hay una sesión de caja abierta para este usuario. Abre caja para registrar ventas.'
          : 'No hay una sesión de caja abierta. Abre caja para registrar ventas.',
      );
    }

    // Si se envía cash_session_id debe coincidir con la sesión abierta
    if (dto.cash_session_id && dto.cash_session_id !== openSession.id) {
      throw new BadRequestException(
        userId
          ? 'La venta debe asociarse a tu sesión de caja abierta actual.'
          : 'La venta debe asociarse a la sesión de caja abierta actual.',
      );
    }

    // Forzar asociación a la sesión abierta (incluye casos en los que no se envió cash_session_id)
    dto.cash_session_id = openSession.id;

    // ⚠️ VALIDACIÓN INICIAL DE STOCK (antes de la transacción para rechazar rápidamente)
    // Esta es una validación rápida sin locks. La validación definitiva con locks se hace dentro de la transacción.
    const stockValidationStart = Date.now();
    await this.validateStockAvailability(storeId, dto, userId);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:768',message:'STOCK_VALIDATION_PRE_TX',data:{duration:Date.now()-stockValidationStart,itemsCount:dto.items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // ⚠️ VALIDACIÓN DE CRÉDITO FIAO (antes de la transacción)
    // Calcular total aproximado para validación (sin descuentos de promoción aún)
    if (dto.payment_method === 'FIAO') {
      const fiaoValidationStart = Date.now();
      // ⚡ OPTIMIZACIÓN: Batch query en lugar de N+1 queries
      const productIds = dto.items.map(item => item.product_id);
      const products = await this.productRepository.find({
        where: {
          id: In(productIds),
          store_id: storeId,
        },
      });
      const productMap = new Map<string, Product>();
      for (const product of products) {
        productMap.set(product.id, product);
      }

      // Calcular subtotal aproximado para validación rápida
      let approximateTotalUsd = 0;
      for (const item of dto.items) {
        const product = productMap.get(item.product_id);
        if (product) {
          const qty = item.is_weight_product && item.weight_value
            ? Number(item.weight_value)
            : Number(item.qty) || 0;
          const priceUsd = item.price_per_weight_usd || product.price_usd || 0;
          const discountUsd = item.discount_usd || 0;
          approximateTotalUsd += (priceUsd * qty) - discountUsd;
        }
      }
      await this.validateFIAOCredit(storeId, dto, approximateTotalUsd);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:799',message:'FIAO_VALIDATION_PRE_TX',data:{duration:Date.now()-fiaoValidationStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }

    // Usar transacción con retry logic para deadlocks
    const transactionStart = Date.now();
    const saleWithDebt = await this.transactionWithRetry(async (manager) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:803',message:'TRANSACTION_START',data:{},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      // Manejar información del cliente (opcional para todas las ventas)
      const customerStart = Date.now();
      let finalCustomerId: string | null = null;

      // Si se proporciona customer_id, usarlo directamente
      if (dto.customer_id) {
        const existingCustomer = await manager.findOne(Customer, {
          where: { id: dto.customer_id, store_id: storeId },
        });
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
          // Opcionalmente actualizar datos si se proporcionan
          if (
            dto.customer_name ||
            dto.customer_phone !== undefined ||
            dto.customer_note !== undefined
          ) {
            if (dto.customer_name) existingCustomer.name = dto.customer_name;
            if (dto.customer_phone !== undefined)
              existingCustomer.phone = dto.customer_phone || null;
            if (dto.customer_note !== undefined)
              existingCustomer.note = dto.customer_note || null;
            existingCustomer.updated_at = new Date();
            await manager.save(Customer, existingCustomer);
          }
        }
      }
      // Si se proporcionan datos de cliente (nombre, cédula, etc.) y NO hay customer_id
      else if (
        dto.customer_name ||
        dto.customer_document_id ||
        dto.customer_phone
      ) {
        // Si hay nombre, la cédula es obligatoria
        if (dto.customer_name && !dto.customer_document_id) {
          throw new BadRequestException(
            'Si proporcionas el nombre del cliente, la cédula es obligatoria',
          );
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
          if (dto.customer_phone !== undefined)
            customer.phone = dto.customer_phone || null;
          if (dto.customer_note !== undefined)
            customer.note = dto.customer_note || null;
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
          throw new BadRequestException(
            'FIAO requiere información del cliente (nombre y cédula) o un customer_id existente',
          );
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:889',message:'CUSTOMER_HANDLING',data:{duration:Date.now()-customerStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      const saleId = randomUUID();
      const soldAt = new Date();

      // Determinar bodega de venta
      const warehouseStart = Date.now();
      let warehouseId: string | null = null;
      if (dto.warehouse_id) {
        // Validar que la bodega existe y pertenece a la tienda
        await this.warehousesService.findOne(storeId, dto.warehouse_id);
        warehouseId = dto.warehouse_id;
      } else {
        // Usar bodega por defecto si no se especifica
        const defaultWarehouse =
          await this.warehousesService.getDefaultOrFirst(storeId);
        warehouseId = defaultWarehouse.id;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:903',message:'WAREHOUSE_DETERMINATION',data:{duration:Date.now()-warehouseStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      // ⚡ OPTIMIZACIÓN: Obtener todos los productos en una sola query batch
      const productsQueryStart = Date.now();
      const productIds = dto.items.map((item) => item.product_id);
      const variantIds = dto.items
        .map((item) => item.variant_id)
        .filter((id): id is string => !!id);

      // Batch query para productos
      const products = await manager.find(Product, {
        where: {
          id: In(productIds),
          store_id: storeId,
          is_active: true,
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:912',message:'PRODUCTS_BATCH_QUERY',data:{duration:Date.now()-productsQueryStart,productsCount:products.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'I'})}).catch(()=>{});
      // #endregion

      // Crear mapa de productos para acceso O(1)
      const productMap = new Map<string, Product>();
      for (const product of products) {
        productMap.set(product.id, product);
      }

      // Batch query para variantes si hay alguna
      const variantMap = new Map<string, ProductVariant>();
      if (variantIds.length > 0) {
        const variants = await manager.find(ProductVariant, {
          where: {
            id: In(variantIds),
          },
        });
        for (const variant of variants) {
          variantMap.set(variant.id, variant);
        }
      }

      // ⚡ OPTIMIZACIÓN CRÍTICA: Batch queries para seriales y lotes en paralelo (evita N+1)
      const serialsLotsStart = Date.now();
      const productsWithSerials = productIds.filter(id => {
        const product = productMap.get(id);
        return product && !product.is_weight_product;
      });
      
      // ⚡ OPTIMIZACIÓN: Ejecutar queries de seriales y lotes en paralelo
      const [allSerials, allLots] = await Promise.all([
        productsWithSerials.length > 0
          ? manager.find(ProductSerial, {
              where: { product_id: In(productsWithSerials) },
            })
          : Promise.resolve([]),
        manager.find(ProductLot, {
          where: { product_id: In(productIds) },
        }),
      ]);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:951',message:'SERIALS_LOTS_BATCH_QUERY',data:{duration:Date.now()-serialsLotsStart,serialsCount:allSerials.length,lotsCount:allLots.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'J'})}).catch(()=>{});
      // #endregion

      // Crear mapas para acceso rápido
      const serialsMap = new Map<string, ProductSerial[]>();
      for (const serial of allSerials) {
        const existing = serialsMap.get(serial.product_id) || [];
        existing.push(serial);
        serialsMap.set(serial.product_id, existing);
      }

      const lotsMap = new Map<string, ProductLot[]>();
      for (const lot of allLots) {
        const existing = lotsMap.get(lot.product_id) || [];
        existing.push(lot);
        lotsMap.set(lot.product_id, existing);
      }

      // Validar que todos los productos existen
      for (const productId of productIds) {
        if (!productMap.has(productId)) {
          throw new NotFoundException(
            `Producto ${productId} no encontrado o inactivo`,
          );
        }
      }

      // Obtener productos y calcular totales
      const items: SaleItem[] = [];
      let subtotalBs = 0;
      let subtotalUsd = 0;
      let netSubtotalBs = 0;
      let netSubtotalUsd = 0;
      let discountBs = 0;
      let discountUsd = 0;
      let discountPercentage = 0;
      let discountValidation: DiscountValidationResult | null = null;

      // Procesar cada item del carrito (ahora usando el mapa)
      for (const cartItem of dto.items) {
        const product = productMap.get(cartItem.product_id);
        if (!product) {
          // Esto no debería pasar porque ya validamos arriba, pero por seguridad
          throw new NotFoundException(
            `Producto ${cartItem.product_id} no encontrado o inactivo`,
          );
        }

        // Manejar variante si se proporciona (usando el mapa)
        let variant: ProductVariant | null = null;
        if (cartItem.variant_id) {
          variant = variantMap.get(cartItem.variant_id) || null;

          if (!variant) {
            throw new NotFoundException(
              `Variante ${cartItem.variant_id} no encontrada para el producto ${product.name}`,
            );
          }

          // Validar que la variante pertenece al producto
          if (variant.product_id !== product.id) {
            throw new BadRequestException(
              `La variante ${cartItem.variant_id} no pertenece al producto ${product.id}`,
            );
          }

          if (!variant.is_active) {
            throw new BadRequestException(
              `La variante ${variant.variant_type}: ${variant.variant_value} está desactivada`,
            );
          }
        }

        const isWeightProduct = Boolean(
          cartItem.is_weight_product || product.is_weight_product,
        );
        const weightValue = isWeightProduct
          ? Number(cartItem.weight_value ?? cartItem.qty)
          : 0;

        if (isWeightProduct && weightValue <= 0) {
          throw new BadRequestException(
            `Peso inválido para el producto ${product.name}`,
          );
        }

        const requestedQty = isWeightProduct ? weightValue : cartItem.qty;

        // ⚡ OPTIMIZACIÓN: Usar mapas pre-cargados en lugar de queries individuales
        if (!isWeightProduct) {
          const productSerials = serialsMap.get(product.id) || [];
          // Si el producto tiene seriales, validar que haya suficientes disponibles
          if (productSerials.length > 0) {
            const availableSerials = productSerials.filter(
              (s) => s.status === 'available',
            );

            if (availableSerials.length < requestedQty) {
              throw new BadRequestException(
                `No hay suficientes seriales disponibles para ${product.name}. Disponibles: ${availableSerials.length}, Solicitados: ${requestedQty}`,
              );
            }
          }
        }

        // ⚡ OPTIMIZACIÓN: Usar mapa pre-cargado en lugar de query individual
        const productLots = lotsMap.get(product.id) || [];

        let lotId: string | null = null;

        // Si el producto tiene lotes, usar lógica FIFO
        if (productLots.length > 0) {
          // ⚡ OPTIMIZACIÓN: Bloquear lotes con SELECT FOR UPDATE SKIP LOCKED
          // SKIP LOCKED evita deadlocks al saltar filas ya bloqueadas por otras transacciones
          // Esto permite que múltiples ventas procesen lotes diferentes en paralelo
          const lotsLockStart = Date.now();
          const lockedLots = await manager
            .createQueryBuilder(ProductLot, 'lot')
            .where('lot.product_id = :productId', { productId: product.id })
            .andWhere('lot.remaining_quantity > 0')
            .orderBy('lot.expiration_date', 'ASC', 'NULLS LAST') // FIFO: lotes más antiguos primero
            .setLock('pessimistic_write', undefined, ['SKIP LOCKED'])
            .getMany();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1067',message:'LOTS_FIFO_LOCK',data:{duration:Date.now()-lotsLockStart,productId:product.id,lockedLotsCount:lockedLots.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'K'})}).catch(()=>{});
          // #endregion

          if (lockedLots.length === 0) {
            throw new BadRequestException(
              `No hay stock disponible en lotes para ${product.name}`,
            );
          }

          // Obtener asignación FIFO (excluye lotes vencidos automáticamente)
          const allocations = this.inventoryRulesService.getLotsForSale(
            product.id,
            requestedQty,
            lockedLots,
          );

          // Usar el primer lote asignado (puede haber múltiples si se agota uno)
          // En una implementación más completa, podríamos crear múltiples sale_items
          // uno por cada lote asignado, pero por simplicidad usamos el primero
          lotId = allocations[0]?.lot_id || null;

          // Actualizar remaining_quantity de los lotes asignados (ya están bloqueados)
          for (const allocation of allocations) {
            const lot = lockedLots.find((l) => l.id === allocation.lot_id);
            if (lot) {
              lot.remaining_quantity = Number(lot.remaining_quantity) - allocation.quantity;
              lot.updated_at = new Date();
              await manager.save(ProductLot, lot);

              // Crear movimiento de lote
              const lotMovement = manager.create(LotMovement, {
                id: randomUUID(),
                lot_id: lot.id,
                movement_type: 'sold',
                qty_delta: -allocation.quantity,
                happened_at: soldAt,
                sale_id: saleId,
                note: `Venta ${saleId}`,
              });
              await manager.save(LotMovement, lotMovement);
            }
          }
        } else {
          // ⚠️ VALIDACIÓN CON LOCK: Verificar stock normal con SELECT FOR UPDATE para evitar race conditions
          // Esta validación se hace DENTRO de la transacción con lock para garantizar atomicidad
          const stockLockStart = Date.now();
          const currentStock = warehouseId
            ? await this.validateAndLockStock(
                manager,
                storeId,
                warehouseId,
                product.id,
                variant?.id || null,
                requestedQty,
              )
            : await this.validateAndLockTotalStock(
                manager,
                storeId,
                product.id,
                variant?.id || null,
                requestedQty,
              );
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1117',message:'STOCK_LOCK_QUERY',data:{duration:Date.now()-stockLockStart,productId:product.id,warehouseId,variantId:variant?.id||null},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'L'})}).catch(()=>{});
          // #endregion

          if (currentStock < requestedQty) {
            const variantInfo = variant
              ? ` (${variant.variant_type}: ${variant.variant_value})`
              : '';
            throw new BadRequestException(
              `Stock insuficiente para ${product.name}${variantInfo}. Disponible: ${currentStock}, Solicitado: ${requestedQty}`,
            );
          }
        }

        // Calcular precios
        // Primero intentar obtener precio de lista de precio (solo productos normales)
        let priceBs = variant?.price_bs ?? product.price_bs;
        let priceUsd = variant?.price_usd ?? product.price_usd;

        if (dto.price_list_id && !isWeightProduct) {
          const listPrice = await this.priceListsService.getProductPrice(
            storeId,
            product.id,
            variant?.id || null,
            requestedQty,
            dto.price_list_id,
          );

          if (listPrice) {
            priceBs = listPrice.price_bs;
            priceUsd = listPrice.price_usd;
          }
        }

        let effectiveQty = requestedQty;
        let itemSubtotalBs = 0;
        let itemSubtotalUsd = 0;

        if (isWeightProduct) {
          const pricePerWeightBs =
            cartItem.price_per_weight_bs ?? product.price_per_weight_bs ?? 0;
          const pricePerWeightUsd =
            cartItem.price_per_weight_usd ?? product.price_per_weight_usd ?? 0;

          const allowedPriceDeviation = 0.05;
          const canOverridePrice =
            effectiveUserRole === 'owner' || effectiveUserRole === 'admin';

          if (product.price_per_weight_bs && pricePerWeightBs) {
            const deviationBs =
              Math.abs(pricePerWeightBs - product.price_per_weight_bs) /
              Number(product.price_per_weight_bs);
            if (deviationBs > 0) {
              if (deviationBs > allowedPriceDeviation && !canOverridePrice) {
                await this.securityAuditService.log({
                  event_type: 'price_modification',
                  store_id: storeId,
                  user_id: userId,
                  status: 'blocked',
                  details: {
                    product_id: product.id,
                    original_price_bs: Number(product.price_per_weight_bs),
                    modified_price_bs: Number(pricePerWeightBs),
                    deviation_percent: deviationBs * 100,
                  },
                });
                throw new BadRequestException(
                  `El precio modificado requiere autorización. Precio original: $${Number(product.price_per_weight_bs).toFixed(2)}, Precio recibido: $${Number(pricePerWeightBs).toFixed(2)}`,
                );
              }

              await this.securityAuditService.log({
                event_type: 'price_modification',
                store_id: storeId,
                user_id: userId,
                status: 'success',
                details: {
                  product_id: product.id,
                  original_price_bs: Number(product.price_per_weight_bs),
                  modified_price_bs: Number(pricePerWeightBs),
                  deviation_percent: deviationBs * 100,
                },
              });
            }
          }

          if (product.price_per_weight_usd && pricePerWeightUsd) {
            const deviationUsd =
              Math.abs(pricePerWeightUsd - product.price_per_weight_usd) /
              Number(product.price_per_weight_usd);
            if (deviationUsd > 0) {
              if (deviationUsd > allowedPriceDeviation && !canOverridePrice) {
                await this.securityAuditService.log({
                  event_type: 'price_modification',
                  store_id: storeId,
                  user_id: userId,
                  status: 'blocked',
                  details: {
                    product_id: product.id,
                    original_price_usd: Number(product.price_per_weight_usd),
                    modified_price_usd: Number(pricePerWeightUsd),
                    deviation_percent: deviationUsd * 100,
                  },
                });
                throw new BadRequestException(
                  `El precio modificado requiere autorización. Precio original: $${Number(product.price_per_weight_usd).toFixed(2)}, Precio recibido: $${Number(pricePerWeightUsd).toFixed(2)}`,
                );
              }

              await this.securityAuditService.log({
                event_type: 'price_modification',
                store_id: storeId,
                user_id: userId,
                status: 'success',
                details: {
                  product_id: product.id,
                  original_price_usd: Number(product.price_per_weight_usd),
                  modified_price_usd: Number(pricePerWeightUsd),
                  deviation_percent: deviationUsd * 100,
                },
              });
            }
          }

          if (pricePerWeightBs <= 0 && pricePerWeightUsd <= 0) {
            throw new BadRequestException(
              `Precio por peso inválido para el producto ${product.name}`,
            );
          }

          // Para productos por peso guardamos qty = peso y unit_price = precio por unidad
          priceBs = pricePerWeightBs;
          priceUsd = pricePerWeightUsd;
          itemSubtotalBs = priceBs * effectiveQty;
          itemSubtotalUsd = priceUsd * effectiveQty;
        } else {
          itemSubtotalBs = priceBs * effectiveQty;
          itemSubtotalUsd = priceUsd * effectiveQty;
        }

        const itemDiscountBs = cartItem.discount_bs || 0;
        const itemDiscountUsd = cartItem.discount_usd || 0;
        const itemNetSubtotalBs = itemSubtotalBs - itemDiscountBs;
        const itemNetSubtotalUsd = itemSubtotalUsd - itemDiscountUsd;

        subtotalBs += itemSubtotalBs;
        subtotalUsd += itemSubtotalUsd;
        netSubtotalBs += itemNetSubtotalBs;
        netSubtotalUsd += itemNetSubtotalUsd;
        discountBs += itemDiscountBs;
        discountUsd += itemDiscountUsd;

        // Crear sale item
        const saleItem = manager.create(SaleItem, {
          id: randomUUID(),
          sale_id: saleId,
          product_id: product.id,
          variant_id: variant?.id || null,
          lot_id: lotId,
          qty: effectiveQty,
          unit_price_bs: priceBs,
          unit_price_usd: priceUsd,
          discount_bs: itemDiscountBs,
          discount_usd: itemDiscountUsd,
          is_weight_product: isWeightProduct,
          weight_unit: isWeightProduct
            ? cartItem.weight_unit || product.weight_unit || null
            : null,
          weight_value: isWeightProduct ? weightValue : null,
          price_per_weight_bs: isWeightProduct
            ? cartItem.price_per_weight_bs ?? product.price_per_weight_bs ?? null
            : null,
          price_per_weight_usd: isWeightProduct
            ? cartItem.price_per_weight_usd ?? product.price_per_weight_usd ?? null
            : null,
        });

        items.push(saleItem);
      }

      // Aplicar promoción si se especifica
      let promotionDiscountBs = 0;
      let promotionDiscountUsd = 0;

      if (dto.promotion_id) {
        const promotion = await this.promotionsService.getPromotionById(
          storeId,
          dto.promotion_id,
        );

        // Validar promoción
        const validation = await this.promotionsService.validatePromotion(
          storeId,
          dto.promotion_id,
          netSubtotalBs,
          netSubtotalUsd,
          finalCustomerId,
        );

        if (!validation.valid) {
          throw new BadRequestException(
            validation.error || 'La promoción no puede aplicarse',
          );
        }

        // Calcular descuento de promoción
        const promotionDiscount =
          this.promotionsService.calculatePromotionDiscount(
            promotion,
            netSubtotalBs,
            netSubtotalUsd,
          );

        promotionDiscountBs = promotionDiscount.discount_bs;
        promotionDiscountUsd = promotionDiscount.discount_usd;

        // Agregar descuento de promoción a los descuentos totales
        discountBs += promotionDiscountBs;
        discountUsd += promotionDiscountUsd;
      }

      // Calcular totales - redondear a 2 decimales para consistencia contable
      const roundTwo = (value: number) => Math.round(value * 100) / 100;
      const totalBs = roundTwo(subtotalBs - discountBs);
      const totalUsd = roundTwo(subtotalUsd - discountUsd);

      // Redondear subtotales y descuentos antes de guardar
      const roundedSubtotalBs = roundTwo(subtotalBs);
      const roundedSubtotalUsd = roundTwo(subtotalUsd);
      const roundedDiscountBs = roundTwo(discountBs);
      const roundedDiscountUsd = roundTwo(discountUsd);

      // Validar descuentos si hay alguno
      if (discountBs > 0 || discountUsd > 0) {
        // Calcular porcentaje de descuento basado en el subtotal original
        discountPercentage =
          subtotalBs > 0
            ? (discountBs / subtotalBs) * 100
            : subtotalUsd > 0
              ? (discountUsd / subtotalUsd) * 100
              : 0;

        discountValidation = await this.discountRulesService.requiresAuthorization(
          storeId,
          discountBs,
          discountUsd,
          discountPercentage,
        );

        if (discountValidation.error) {
          throw new BadRequestException(discountValidation.error);
        }

        if (
          discountValidation.requires_authorization &&
          !discountValidation.auto_approved
        ) {
          const config = await this.discountRulesService.getOrCreateConfig(
            storeId,
          );
          const canAuthorize =
            this.discountRulesService.validateAuthorizationRole(
              effectiveUserRole,
              config,
            );

          if (!canAuthorize) {
            throw new BadRequestException(
              'Este descuento requiere autorización de un supervisor.',
            );
          }
        }
      }

      const splitSummary =
        dto.payment_method === 'SPLIT'
          ? dto.split || this.buildSplitSummary(dto.split_payments, dto.exchange_rate)
          : dto.split;

      // Validar método de pago según configuración de topes
      if (dto.payment_method === 'SPLIT') {
        if (!splitSummary && (!dto.split_payments || dto.split_payments.length === 0)) {
          throw new BadRequestException(
            'Debes especificar los pagos divididos para ventas mixtas',
          );
        }

        if (splitSummary) {
          // Validar pago split
          const splitValidation =
            await this.paymentRulesService.validateSplitPayment(
              storeId,
              splitSummary,
            );

          if (!splitValidation.valid) {
            throw new BadRequestException(splitValidation.error);
          }
        }
      } else {
        // Validar método de pago individual
        const currency = dto.currency === 'BS' ? 'BS' : 'USD';
        const amount = currency === 'BS' ? totalBs : totalUsd;
        const validation = await this.paymentRulesService.validatePaymentMethod(
          storeId,
          dto.payment_method,
          amount,
          currency,
        );
        if (!validation.valid) {
          throw new BadRequestException(validation.error);
        }
      }

      await this.validatePaymentAuthorization(storeId, dto, userRole);

      // Generar número de factura automáticamente
      const invoiceNumberStart = Date.now();
      let invoiceSeriesId: string | null = null;
      let invoiceNumber: string | null = null;
      let invoiceFullNumber: string | null = null;

      try {
        const invoiceData =
          await this.invoiceSeriesService.generateNextInvoiceNumber(
            storeId,
            dto.invoice_series_id,
          );
        invoiceSeriesId = invoiceData.series.id;
        invoiceNumber = invoiceData.invoice_number;
        invoiceFullNumber = invoiceData.invoice_full_number;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1451',message:'INVOICE_NUMBER_GENERATION',data:{duration:Date.now()-invoiceNumberStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'M'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        // Si no hay series configuradas, la venta se crea sin número de factura
        // Esto permite que el sistema funcione aunque no se hayan configurado series
        this.logger.warn(
          'No se pudo generar número de factura',
          error instanceof Error ? error.stack : String(error),
        );
      }

      const saleNumberStart = Date.now();
      const saleNumber = await this.getNextSaleNumber(manager, storeId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1469',message:'SALE_NUMBER_GENERATION',data:{duration:Date.now()-saleNumberStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'N'})}).catch(()=>{});
      // #endregion

      // Crear la venta
      const sale = manager.create(Sale, {
        id: saleId,
        store_id: storeId,
        cash_session_id: dto.cash_session_id || null,
        sold_at: soldAt,
        sale_number: saleNumber,
        exchange_rate: dto.exchange_rate,
        currency: dto.currency,
        totals: {
          subtotal_bs: roundedSubtotalBs,
          subtotal_usd: roundedSubtotalUsd,
          discount_bs: roundedDiscountBs,
          discount_usd: roundedDiscountUsd,
          total_bs: totalBs,
          total_usd: totalUsd,
        },
        payment: {
          method: dto.payment_method,
          split: splitSummary || undefined,
          split_payments:
            dto.split_payments && dto.split_payments.length > 0
              ? dto.split_payments
              : undefined,
          cash_payment: dto.cash_payment || undefined,
          cash_payment_bs: dto.cash_payment_bs || undefined,
        },
        customer_id: finalCustomerId,
        sold_by_user_id: userId, // Ya validado arriba que userId no puede ser null/undefined
        note: dto.note || null,
        invoice_series_id: invoiceSeriesId,
        invoice_number: invoiceNumber,
        invoice_full_number: invoiceFullNumber,
      });

      const saveSaleStart = Date.now();
      const savedSale = await manager.save(Sale, sale);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1506',message:'SAVE_SALE',data:{duration:Date.now()-saveSaleStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'O'})}).catch(()=>{});
      // #endregion

      // Guardar items
      const saveItemsStart = Date.now();
      await manager.save(SaleItem, items);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1509',message:'SAVE_SALE_ITEMS',data:{duration:Date.now()-saveItemsStart,itemsCount:items.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'P'})}).catch(()=>{});
      // #endregion

      if (discountBs > 0 || discountUsd > 0) {
        await this.securityAuditService.log({
          event_type: 'discount_applied',
          store_id: storeId,
          user_id: userId,
          status: 'success',
          details: {
            sale_id: savedSale.id,
            discount_bs: roundedDiscountBs,
            discount_usd: roundedDiscountUsd,
            discount_percentage: roundTwo(discountPercentage),
            requires_authorization:
              discountValidation?.requires_authorization || false,
            promotion_id: dto.promotion_id || null,
          },
        });
      }

      // Registrar uso de promoción si se aplicó
      if (
        dto.promotion_id &&
        (promotionDiscountBs > 0 || promotionDiscountUsd > 0)
      ) {
        await this.promotionsService.recordPromotionUsage(
          dto.promotion_id,
          savedSale.id,
          finalCustomerId,
          promotionDiscountBs,
          promotionDiscountUsd,
        );
      }

      // ⚡ OPTIMIZACIÓN CRÍTICA: Crear movimientos y actualizar stocks en batch
      // Solo si el producto NO tiene lotes (los lotes ya se manejaron arriba)
      const movementsToCreate: InventoryMovement[] = [];
      const stockUpdates: Array<{
        product_id: string;
        variant_id: string | null;
        qty_delta: number;
      }> = [];

      for (const item of items) {
        // Verificar si este item tiene lote asignado
        // Si tiene lote, el movimiento ya se creó en la lógica FIFO
        if (!item.lot_id) {
          const movement = manager.create(InventoryMovement, {
            id: randomUUID(),
            store_id: storeId,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            movement_type: 'sold',
            qty_delta: -item.qty, // Negativo para descontar
            unit_cost_bs: 0,
            unit_cost_usd: 0,
            warehouse_id: warehouseId,
            note: `Venta ${saleId}`,
            ref: { sale_id: saleId, warehouse_id: warehouseId },
            happened_at: soldAt,
            approved: true, // Las ventas se aprueban automáticamente
          });

          movementsToCreate.push(movement);

          // Acumular actualizaciones de stock para batch
          if (warehouseId) {
            stockUpdates.push({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              qty_delta: -item.qty, // Negativo para descontar
            });
          }
        }
      }

      // ⚡ OPTIMIZACIÓN: Batch save de movimientos
      if (movementsToCreate.length > 0) {
        const saveMovementsStart = Date.now();
        await manager.save(InventoryMovement, movementsToCreate);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1587',message:'SAVE_INVENTORY_MOVEMENTS',data:{duration:Date.now()-saveMovementsStart,movementsCount:movementsToCreate.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'Q'})}).catch(()=>{});
        // #endregion
      }

      // ⚡ OPTIMIZACIÓN CRÍTICA: Batch update de stocks (reduce de N queries a 1-2 queries)
      if (warehouseId && stockUpdates.length > 0) {
        const updateStockBatchStart = Date.now();
        await this.warehousesService.updateStockBatch(
          warehouseId,
          stockUpdates,
          storeId,
          manager,
        );
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1592',message:'UPDATE_STOCK_BATCH',data:{duration:Date.now()-updateStockBatchStart,updatesCount:stockUpdates.length},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'R'})}).catch(()=>{});
        // #endregion
      }

      // ⚠️ VALIDACIÓN CRÍTICA: Si es venta FIAO, DEBE haber un cliente válido
      if (dto.payment_method === 'FIAO' && !finalCustomerId) {
        throw new BadRequestException(
          'Las ventas FIAO requieren un cliente válido. No se puede procesar la venta sin identificar al cliente.',
        );
      }

      // Si es venta FIAO, crear la deuda automáticamente
      // ⚠️ EDGE CASE: Validar crédito nuevamente dentro de la transacción (con el total real)
      if (dto.payment_method === 'FIAO' && finalCustomerId) {
        // Validar crédito nuevamente con el total real calculado (puede diferir del aproximado)
        const customer = await manager.findOne(Customer, {
          where: { id: finalCustomerId, store_id: storeId },
        });

        if (!customer) {
          throw new NotFoundException('Cliente no encontrado');
        }

        if (customer.credit_limit === null || customer.credit_limit <= 0) {
          throw new BadRequestException(
            'El cliente no tiene crédito habilitado para compras FIAO',
          );
        }

        // Calcular deuda actual dentro de la transacción
        const debtResult = await manager.query(
          `
          SELECT COALESCE(SUM(
            amount_usd - COALESCE((
              SELECT SUM(amount_usd) FROM debt_payments WHERE debt_id = d.id
            ), 0)
          ), 0) as current_debt
          FROM debts d
          WHERE store_id = $1 
            AND customer_id = $2
            AND status != 'paid'
        `,
          [storeId, finalCustomerId],
        );

        const currentDebt = parseFloat(debtResult[0]?.current_debt || '0');
        const availableCredit = Number(customer.credit_limit) - currentDebt;

        // Validar que el crédito disponible sea suficiente con el total real
        if (availableCredit < totalUsd) {
          throw new BadRequestException(
            `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} USD, Total de venta: $${totalUsd.toFixed(2)} USD`,
          );
        }

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

      // ⚡ OPTIMIZACIÓN: Query simplificada con todos los datos necesarios en una sola query
      // Incluir payments en el JOIN para evitar query adicional
      const finalQueryStart = Date.now();
      const savedSaleWithItems = await manager
        .createQueryBuilder(Sale, 'sale')
        .leftJoinAndSelect('sale.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('sale.sold_by_user', 'sold_by_user')
        .leftJoinAndSelect('sale.customer', 'customer')
        .leftJoin('debts', 'debt', 'debt.sale_id = sale.id')
        .leftJoin('debt_payments', 'payment', 'payment.debt_id = debt.id')
        .addSelect([
          'debt.id',
          'debt.status',
          'debt.amount_bs',
          'debt.amount_usd',
          'payment.id',
          'payment.amount_bs',
          'payment.amount_usd',
        ])
        .where('sale.id = :saleId', { saleId })
        .getOne();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1665',message:'FINAL_SALE_QUERY',data:{duration:Date.now()-finalQueryStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'S'})}).catch(()=>{});
      // #endregion

      if (!savedSaleWithItems) {
        throw new Error('Error al recuperar la venta creada');
      }

      // ⚡ OPTIMIZACIÓN: Calcular pagos desde los datos ya cargados (sin query adicional)
      const saleWithDebt = savedSaleWithItems as any;
      if (saleWithDebt.debt) {
        // Los payments ya están en el resultado del query (aunque TypeORM puede no exponerlos directamente)
        // Si no están disponibles, hacer query solo si es necesario
        const debtId = saleWithDebt.debt.id;
        if (debtId) {
          const debtWithPayments = await manager
            .createQueryBuilder(Debt, 'debt')
            .leftJoinAndSelect('debt.payments', 'payments')
            .where('debt.id = :debtId', { debtId })
            .getOne();
          
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
            saleWithDebt.debt.remaining_bs =
              Number(debtWithPayments.amount_bs) - totalPaidBs;
            saleWithDebt.debt.remaining_usd =
              Number(debtWithPayments.amount_usd) - totalPaidUsd;
          }
        }
      }

      // Agregar información de factura fiscal si existe (después de la transacción)
      // Nota: La factura fiscal se crea después de la venta
      saleWithDebt.fiscal_invoice = null;

      return saleWithDebt;
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1726',message:'TRANSACTION_COMPLETE',data:{duration:Date.now()-transactionStart},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'T'})}).catch(()=>{});
    // #endregion

    // ⚡ OPTIMIZACIÓN: Encolar tareas post-venta de forma asíncrona
    // Esto permite retornar la respuesta inmediatamente sin esperar
    // facturas fiscales y asientos contables (que pueden tardar 1-3 segundos)
    try {
      await this.salesPostProcessingQueue.add(
        'post-process-sale',
        {
          storeId,
          saleId: saleWithDebt.id,
          userId: userId || undefined,
        },
        {
          priority: 5, // Prioridad media para tareas post-venta
          jobId: `post-process-${saleWithDebt.id}`, // Evitar duplicados
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s (más tiempo para operaciones pesadas)
          },
          removeOnComplete: {
            age: 3600, // Mantener por 1 hora
            count: 500,
          },
          removeOnFail: {
            age: 86400, // Mantener jobs fallidos por 24 horas
          },
        },
      );
      this.logger.debug(
        `Tareas post-venta encoladas para venta ${saleWithDebt.id}`,
      );
    } catch (error) {
      // Log error pero no fallar la venta
      this.logger.error(
        `Error encolando tareas post-venta para venta ${saleWithDebt.id}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Retornar venta inmediatamente (sin factura fiscal ni asiento contable)
    // Estos se procesarán en background
    saleWithDebt.fiscal_invoice = null; // Se agregará cuando se procese en background

    const duration = Date.now() - startTime;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.service.ts:1771',message:'SALE_CREATE_COMPLETE',data:{duration,totalDuration:duration,itemsCount:dto.items?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId,hypothesisId:'U'})}).catch(()=>{});
    // #endregion
    this.logger.log(
      `[SALE_CREATE] ✅ Venta creada exitosamente - ID: ${saleWithDebt.id}, Duración: ${duration}ms, Items: ${dto.items?.length || 0}`,
    );

    // Métricas de performance
    if (duration > 1000) {
      this.logger.warn(
        `[SALE_CREATE] ⚠️ Venta tardó ${duration}ms (objetivo: <500ms) - Store: ${storeId}`,
      );
    }

    return saleWithDebt;
  }

  async findOne(storeId: string, saleId: string): Promise<Sale> {
    // Validar que storeId esté presente
    if (!storeId) {
      throw new BadRequestException('Store ID es requerido');
    }
    
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
    
    // Validación adicional de seguridad: asegurar que la venta pertenece a la tienda
    if (sale.store_id !== storeId) {
      throw new UnauthorizedException(
        'No tienes permisos para ver esta venta',
      );
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
      saleWithDebt.debt.remaining_bs =
        Number(saleWithDebt.debt.amount_bs || 0) - totalPaidBs;
      saleWithDebt.debt.remaining_usd =
        Number(saleWithDebt.debt.amount_usd || 0) - totalPaidUsd;
    }

    // Agregar información de factura fiscal si existe
    try {
      const fiscalInvoice = await this.fiscalInvoicesService.findBySale(
        storeId,
        saleId,
      );
      if (fiscalInvoice) {
        saleWithDebt.fiscal_invoice = {
          id: fiscalInvoice.id,
          invoice_number: fiscalInvoice.invoice_number,
          fiscal_number: fiscalInvoice.fiscal_number,
          status: fiscalInvoice.status,
          issued_at: fiscalInvoice.issued_at,
        };
      }
    } catch (error) {
      // Si no existe factura fiscal, simplemente no se agrega
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
    // Query para contar total (sin joins para mejor rendimiento)
    const countQuery = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId });

    if (dateFrom) {
      countQuery.andWhere('sale.sold_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      countQuery.andWhere('sale.sold_at <= :dateTo', { dateTo });
    }

    const total = await countQuery.getCount();

    // Query para obtener ventas con relaciones
    // Usar find con relations para asegurar que los items se carguen correctamente
    const whereConditions: any = { store_id: storeId };
    
    if (dateFrom && dateTo) {
      whereConditions.sold_at = Between(dateFrom, dateTo);
    } else if (dateFrom) {
      whereConditions.sold_at = MoreThanOrEqual(dateFrom);
    } else if (dateTo) {
      whereConditions.sold_at = LessThanOrEqual(dateTo);
    }

    const sales = await this.saleRepository.find({
      where: whereConditions,
      relations: ['items', 'items.product', 'sold_by_user', 'customer'],
      order: { sold_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Cargar deudas por separado para evitar problemas con el join
    const saleIds = sales.map((s) => s.id);
    const debts =
      saleIds.length > 0
        ? await this.debtRepository.find({
            where: { sale_id: In(saleIds) },
            relations: ['payments'],
            select: ['id', 'sale_id', 'status', 'amount_bs', 'amount_usd'],
          })
        : [];

    // Mapear deudas por sale_id y calcular montos pendientes
    interface DebtWithCalculations {
      id: string;
      sale_id: string | null;
      status: string;
      amount_bs: number;
      amount_usd: number;
      total_paid_bs: number;
      total_paid_usd: number;
      remaining_bs: number;
      remaining_usd: number;
    }
    const debtsBySaleId = new Map<string, DebtWithCalculations>();
    for (const debt of debts) {
      if (debt.sale_id) {
        // Calcular montos pagados
        const payments = debt.payments || [];
        const totalPaidBs = payments.reduce(
          (sum: number, p: DebtPayment) => sum + Number(p.amount_bs || 0),
          0,
        );
        const totalPaidUsd = payments.reduce(
          (sum: number, p: DebtPayment) => sum + Number(p.amount_usd || 0),
          0,
        );

        // Calcular montos pendientes
        const debtAmountBs = Number(debt.amount_bs || 0);
        const debtAmountUsd = Number(debt.amount_usd || 0);
        const remainingBs = debtAmountBs - totalPaidBs;
        const remainingUsd = debtAmountUsd - totalPaidUsd;

        // Agregar información calculada a la deuda
        const debtWithCalculations: DebtWithCalculations = {
          id: debt.id,
          sale_id: debt.sale_id,
          status: debt.status,
          amount_bs: Number(debt.amount_bs || 0),
          amount_usd: Number(debt.amount_usd || 0),
          total_paid_bs: totalPaidBs,
          total_paid_usd: totalPaidUsd,
          remaining_bs: remainingBs,
          remaining_usd: remainingUsd,
        };

        debtsBySaleId.set(debt.sale_id, debtWithCalculations);
      }
    }

    // Asignar deudas a las ventas
    for (const sale of sales) {
      (sale as Sale & { debt?: DebtWithCalculations | null }).debt = debtsBySaleId.get(sale.id) || null;
    }

    // Asegurar que items siempre sea un array (incluso si está vacío)
    for (const sale of sales) {
      if (!sale.items) {
        sale.items = [];
      }
    }

    // Nota: Los cálculos de pagos ya se hicieron arriba cuando se cargaron las deudas
    // con relations: ['payments']. El código de abajo es redundante.
    // Los sales ya tienen la información de debt con total_paid_bs, total_paid_usd, etc.
    // calculados en el loop anterior.

    return { sales, total };
  }

  async voidSale(
    storeId: string,
    saleId: string,
    userId: string,
    reason?: string,
  ): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      if (sale.voided_at) {
        throw new BadRequestException('La venta ya fue anulada');
      }

      // Verificar facturas fiscales asociadas a la venta
      const fiscalInvoices = await manager.find(FiscalInvoice, {
        where: { sale_id: saleId, store_id: storeId },
      });
      
      // Buscar si hay una factura emitida (no nota de crédito)
      const issuedInvoice = fiscalInvoices.find(
        (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
      );
      
      if (issuedInvoice) {
        // Si hay factura emitida, verificar si existe una nota de crédito emitida que la anule
        const issuedCreditNote = fiscalInvoices.find(
          (inv) =>
            inv.invoice_type === 'credit_note' && inv.status === 'issued',
        );
        
        if (!issuedCreditNote) {
          throw new BadRequestException(
            'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de anular la venta.',
          );
        }
      }

      const debt = await manager.findOne(Debt, {
        where: { sale_id: saleId, store_id: storeId },
      });
      if (debt) {
        const paymentsCount = await manager.count(DebtPayment, {
          where: { debt_id: debt.id },
        });
        if (paymentsCount > 0) {
          throw new BadRequestException(
            'La venta tiene pagos asociados. Debes reversar los pagos antes de anular.',
          );
        }
        await manager.delete(DebtPayment, { debt_id: debt.id });
        await manager.delete(Debt, { id: debt.id });
      }

      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

      const saleMovements = await manager
        .createQueryBuilder(InventoryMovement, 'movement')
        .where('movement.store_id = :storeId', { storeId })
        .andWhere("movement.ref ->> 'sale_id' = :saleId", { saleId })
        .getMany();

      const warehouseByItemKey = new Map<string, string | null>();
      for (const movement of saleMovements) {
        const key = `${movement.product_id}:${movement.variant_id || 'null'}`;
        if (!warehouseByItemKey.has(key)) {
          warehouseByItemKey.set(key, movement.warehouse_id || null);
        }
      }

      const now = new Date();
      const reasonNote = reason
        ? `Devolución venta ${saleId}: ${reason}`
        : `Devolución venta ${saleId}`;

      for (const item of saleItems) {
        if (item.lot_id) {
          const lot = await manager.findOne(ProductLot, {
            where: { id: item.lot_id },
          });
          if (lot) {
            lot.remaining_quantity =
              Number(lot.remaining_quantity) + Number(item.qty);
            lot.updated_at = now;
            await manager.save(ProductLot, lot);

            const lotMovement = manager.create(LotMovement, {
              id: randomUUID(),
              lot_id: lot.id,
              movement_type: 'adjusted',
              qty_delta: item.qty,
              happened_at: now,
              sale_id: saleId,
              note: reasonNote,
            });
            await manager.save(LotMovement, lotMovement);
          }
          continue;
        }

        const key = `${item.product_id}:${item.variant_id || 'null'}`;
        const warehouseId = warehouseByItemKey.get(key) || null;

        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          movement_type: 'adjust',
          qty_delta: item.qty,
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: reasonNote,
          ref: { sale_id: saleId, reversal: true, warehouse_id: warehouseId },
          happened_at: now,
          approved: true,
        });
        await manager.save(InventoryMovement, movement);

        if (warehouseId) {
          await this.warehousesService.updateStock(
            warehouseId,
            item.product_id,
            item.variant_id || null,
            item.qty,
            storeId,
          );
        }
      }

      await manager.getRepository(ProductSerial).update(
        { sale_id: saleId },
        {
          status: 'returned',
          sale_id: null,
          sale_item_id: null,
          sold_at: null,
          updated_at: now,
        },
      );

      sale.voided_at = now;
      sale.voided_by_user_id = userId;
      sale.void_reason = reason || null;

      const savedSale = await manager.save(Sale, sale);

      await this.securityAuditService.log({
        event_type: 'sale_void_attempt',
        store_id: storeId,
        user_id: userId,
        status: 'success',
        details: {
          sale_id: saleId,
          reason: reason || null,
        },
      });

      return savedSale;
    });
  }

  async returnItems(
    storeId: string,
    saleId: string,
    dto: ReturnSaleDto,
    userId: string,
  ): Promise<SaleReturn> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debes especificar items a devolver');
    }

    const roundTwo = (value: number) => Math.round(value * 100) / 100;

    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: saleId, store_id: storeId },
        relations: ['items'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      if (sale.voided_at) {
        throw new BadRequestException('La venta está anulada');
      }

      // Verificar facturas fiscales asociadas a la venta
      const fiscalInvoices = await manager.find(FiscalInvoice, {
        where: { sale_id: saleId, store_id: storeId },
      });
      
      // Buscar si hay una factura emitida (no nota de crédito)
      const issuedInvoice = fiscalInvoices.find(
        (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
      );
      
      if (issuedInvoice) {
        // Si hay factura emitida, verificar si existe una nota de crédito emitida que la anule
        const issuedCreditNote = fiscalInvoices.find(
          (inv) =>
            inv.invoice_type === 'credit_note' && inv.status === 'issued',
        );
        
        if (!issuedCreditNote) {
          throw new BadRequestException(
            'La venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de devolver items.',
          );
        }
      }

      const debt = await manager.findOne(Debt, {
        where: { sale_id: saleId, store_id: storeId },
      });
      if (debt) {
        const paymentsCount = await manager.count(DebtPayment, {
          where: { debt_id: debt.id },
        });
        if (paymentsCount > 0) {
          throw new BadRequestException(
            'La venta tiene pagos asociados. Debes reversar los pagos antes de devolver.',
          );
        }
      }

      const saleItems =
        sale.items?.length > 0
          ? sale.items
          : await manager.find(SaleItem, { where: { sale_id: saleId } });

      const saleItemById = new Map(
        saleItems.map((item) => [item.id, item]),
      );

      const saleItemIds = saleItems.map((item) => item.id);
      const existingReturns = saleItemIds.length
        ? await manager
            .createQueryBuilder(SaleReturnItem, 'return_item')
            .select('return_item.sale_item_id', 'sale_item_id')
            .addSelect('SUM(return_item.qty)', 'returned_qty')
            .where('return_item.sale_item_id IN (:...saleItemIds)', {
              saleItemIds,
            })
            .groupBy('return_item.sale_item_id')
            .getRawMany()
        : [];

      const returnedQtyByItem = new Map<string, number>();
      for (const row of existingReturns) {
        returnedQtyByItem.set(
          row.sale_item_id,
          parseFloat(row.returned_qty) || 0,
        );
      }

      const saleMovements = await manager
        .createQueryBuilder(InventoryMovement, 'movement')
        .where('movement.store_id = :storeId', { storeId })
        .andWhere("movement.ref ->> 'sale_id' = :saleId", { saleId })
        .getMany();

      const warehouseByItemKey = new Map<string, string | null>();
      for (const movement of saleMovements) {
        const key = `${movement.product_id}:${movement.variant_id || 'null'}`;
        if (!warehouseByItemKey.has(key)) {
          warehouseByItemKey.set(key, movement.warehouse_id || null);
        }
      }

      const defaultWarehouse =
        await this.warehousesService.getDefaultOrFirst(storeId);
      const returnId = randomUUID();
      const now = new Date();

      let returnSubtotalBs = 0;
      let returnSubtotalUsd = 0;
      let returnDiscountBs = 0;
      let returnDiscountUsd = 0;
      let returnTotalBs = 0;
      let returnTotalUsd = 0;

      const returnItems: SaleReturnItem[] = [];

      for (const itemDto of dto.items) {
        const saleItem = saleItemById.get(itemDto.sale_item_id);
        if (!saleItem) {
          throw new BadRequestException(
            `Item ${itemDto.sale_item_id} no pertenece a la venta`,
          );
        }

        const returnQty = Number(itemDto.qty);
        if (!Number.isFinite(returnQty) || returnQty <= 0) {
          throw new BadRequestException('Cantidad inválida para devolución');
        }

        const isWeightProduct = Boolean(saleItem.is_weight_product);
        if (!isWeightProduct && !Number.isInteger(returnQty)) {
          throw new BadRequestException(
            'La cantidad devuelta debe ser entera para productos no pesados',
          );
        }

        const alreadyReturned = returnedQtyByItem.get(saleItem.id) || 0;
        const remainingQty = Number(saleItem.qty) - alreadyReturned;
        if (returnQty > remainingQty + 0.0001) {
          throw new BadRequestException(
            `Cantidad a devolver excede lo disponible. Disponible: ${remainingQty}`,
          );
        }

        const serialsForItem = await manager.find(ProductSerial, {
          where: { sale_item_id: saleItem.id },
        });

        if (serialsForItem.length > 0) {
          if (!itemDto.serial_ids || itemDto.serial_ids.length === 0) {
            throw new BadRequestException(
              'Debes especificar los seriales a devolver',
            );
          }
          if (!Number.isInteger(returnQty)) {
            throw new BadRequestException(
              'La cantidad devuelta debe ser entera para seriales',
            );
          }
          if (itemDto.serial_ids.length !== returnQty) {
            throw new BadRequestException(
              'La cantidad de seriales debe coincidir con la cantidad devuelta',
            );
          }

          const serialsToReturn = await manager.find(ProductSerial, {
            where: { id: In(itemDto.serial_ids) },
          });

          if (serialsToReturn.length !== itemDto.serial_ids.length) {
            throw new BadRequestException(
              'No se encontraron todos los seriales especificados',
            );
          }

          for (const serial of serialsToReturn) {
            if (serial.sale_item_id !== saleItem.id || serial.status !== 'sold') {
              throw new BadRequestException(
                `El serial ${serial.id} no pertenece a esta venta o no está vendido`,
              );
            }

            serial.status = 'returned';
            serial.sale_id = null;
            serial.sale_item_id = null;
            serial.sold_at = null;
            serial.updated_at = now;
            await manager.save(ProductSerial, serial);
          }
        }

        if (saleItem.lot_id) {
          const lot = await manager.findOne(ProductLot, {
            where: { id: saleItem.lot_id },
          });
          if (lot) {
            lot.remaining_quantity =
              Number(lot.remaining_quantity) + Number(returnQty);
            lot.updated_at = now;
            await manager.save(ProductLot, lot);

            const lotMovement = manager.create(LotMovement, {
              id: randomUUID(),
              lot_id: lot.id,
              movement_type: 'adjusted',
              qty_delta: returnQty,
              happened_at: now,
              sale_id: saleId,
              note: itemDto.note || dto.reason || `Devolución parcial ${saleId}`,
            });
            await manager.save(LotMovement, lotMovement);
          }
        }

        const key = `${saleItem.product_id}:${saleItem.variant_id || 'null'}`;
        const warehouseId = warehouseByItemKey.get(key) || defaultWarehouse.id;

        const movement = manager.create(InventoryMovement, {
          id: randomUUID(),
          store_id: storeId,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          movement_type: 'adjust',
          qty_delta: returnQty,
          unit_cost_bs: 0,
          unit_cost_usd: 0,
          warehouse_id: warehouseId,
          note: itemDto.note || dto.reason || `Devolución parcial ${saleId}`,
          ref: {
            sale_id: saleId,
            sale_item_id: saleItem.id,
            return_id: returnId,
            return: true,
            warehouse_id: warehouseId,
          },
          happened_at: now,
          approved: true,
          requested_by: userId,
          approved_by: userId,
          approved_at: now,
        });
        await manager.save(InventoryMovement, movement);

        if (warehouseId) {
          await this.warehousesService.updateStock(
            warehouseId,
            saleItem.product_id,
            saleItem.variant_id || null,
            returnQty,
            storeId,
          );
        }

        const unitPriceBs = Number(saleItem.unit_price_bs || 0);
        const unitPriceUsd = Number(saleItem.unit_price_usd || 0);
        const itemQty = Number(saleItem.qty) || 1;
        const perUnitDiscountBs =
          itemQty > 0 ? Number(saleItem.discount_bs || 0) / itemQty : 0;
        const perUnitDiscountUsd =
          itemQty > 0 ? Number(saleItem.discount_usd || 0) / itemQty : 0;

        const lineSubtotalBs = unitPriceBs * returnQty;
        const lineSubtotalUsd = unitPriceUsd * returnQty;
        const lineDiscountBs = perUnitDiscountBs * returnQty;
        const lineDiscountUsd = perUnitDiscountUsd * returnQty;
        const lineTotalBs = lineSubtotalBs - lineDiscountBs;
        const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd;

        returnSubtotalBs += lineSubtotalBs;
        returnSubtotalUsd += lineSubtotalUsd;
        returnDiscountBs += lineDiscountBs;
        returnDiscountUsd += lineDiscountUsd;
        returnTotalBs += lineTotalBs;
        returnTotalUsd += lineTotalUsd;

        const returnItem = manager.create(SaleReturnItem, {
          id: randomUUID(),
          return_id: returnId,
          sale_item_id: saleItem.id,
          product_id: saleItem.product_id,
          variant_id: saleItem.variant_id || null,
          lot_id: saleItem.lot_id || null,
          qty: returnQty,
          unit_price_bs: unitPriceBs,
          unit_price_usd: unitPriceUsd,
          discount_bs: roundTwo(lineDiscountBs),
          discount_usd: roundTwo(lineDiscountUsd),
          total_bs: roundTwo(lineTotalBs),
          total_usd: roundTwo(lineTotalUsd),
          serial_ids: itemDto.serial_ids || null,
          note: itemDto.note || null,
        });

        returnItems.push(returnItem);
      }

      const totals = sale.totals || {};
      const updatedSubtotalBs = Math.max(
        0,
        roundTwo(Number(totals.subtotal_bs || 0) - roundTwo(returnSubtotalBs)),
      );
      const updatedSubtotalUsd = Math.max(
        0,
        roundTwo(Number(totals.subtotal_usd || 0) - roundTwo(returnSubtotalUsd)),
      );
      const updatedDiscountBs = Math.max(
        0,
        roundTwo(Number(totals.discount_bs || 0) - roundTwo(returnDiscountBs)),
      );
      const updatedDiscountUsd = Math.max(
        0,
        roundTwo(Number(totals.discount_usd || 0) - roundTwo(returnDiscountUsd)),
      );
      const updatedTotalBs = Math.max(
        0,
        roundTwo(updatedSubtotalBs - updatedDiscountBs),
      );
      const updatedTotalUsd = Math.max(
        0,
        roundTwo(updatedSubtotalUsd - updatedDiscountUsd),
      );

      sale.totals = {
        ...totals,
        subtotal_bs: updatedSubtotalBs,
        subtotal_usd: updatedSubtotalUsd,
        discount_bs: updatedDiscountBs,
        discount_usd: updatedDiscountUsd,
        total_bs: updatedTotalBs,
        total_usd: updatedTotalUsd,
      };
      await manager.save(Sale, sale);

      if (debt) {
        debt.amount_bs = updatedTotalBs;
        debt.amount_usd = updatedTotalUsd;
        debt.status =
          updatedTotalUsd <= 0 ? DebtStatus.PAID : DebtStatus.OPEN;
        await manager.save(Debt, debt);
      }

      const saleReturn = manager.create(SaleReturn, {
        id: returnId,
        store_id: storeId,
        sale_id: saleId,
        created_by: userId,
        reason: dto.reason || null,
        total_bs: roundTwo(returnTotalBs),
        total_usd: roundTwo(returnTotalUsd),
      });

      const savedReturn = await manager.save(SaleReturn, saleReturn);
      await manager.save(SaleReturnItem, returnItems);
      savedReturn.items = returnItems;

      return savedReturn;
    });
  }

  private async getCurrentStock(
    storeId: string,
    productId: string,
  ): Promise<number> {
    return this.warehousesService.getTotalStockQuantity(
      storeId,
      productId,
      null,
    );
  }
}
