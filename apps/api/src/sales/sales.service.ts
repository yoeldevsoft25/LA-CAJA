import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { DiscountRulesService } from '../discounts/discount-rules.service';
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
import { AccountingService } from '../accounting/accounting.service';
import { ConfigValidationService } from '../config/config-validation.service';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { SaleReturnItem } from '../database/entities/sale-return-item.entity';

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
   * Esta es una validación rápida sin locks para rechazar rápidamente si no hay stock.
   * La validación definitiva con locks se hace dentro de la transacción.
   */
  private async validateStockAvailability(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
  ): Promise<void> {
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

    // Validar stock para cada item
    for (const cartItem of dto.items) {
      const product = await this.productRepository.findOne({
        where: {
          id: cartItem.product_id,
          store_id: storeId,
          is_active: true,
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto ${cartItem.product_id} no encontrado o inactivo`,
        );
      }

      // Manejar variante si se proporciona
      let variant: ProductVariant | null = null;
      if (cartItem.variant_id) {
        variant = await this.dataSource.getRepository(ProductVariant).findOne({
          where: { id: cartItem.variant_id, product_id: product.id },
        });

        if (!variant) {
          throw new NotFoundException(
            `Variante ${cartItem.variant_id} no encontrada para el producto ${product.name}`,
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

      // Verificar si el producto tiene lotes
      const productLots = await this.dataSource.getRepository(ProductLot).find({
        where: { product_id: product.id },
      });

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
        // Producto sin lotes: validar stock normal
        const currentStock = warehouseId
          ? await this.warehousesService.getStockQuantity(
              storeId,
              warehouseId,
              product.id,
              variant?.id || null,
            )
          : await this.warehousesService.getTotalStockQuantity(
              storeId,
              product.id,
              variant?.id || null,
            );

        if (currentStock < requestedQty) {
          const variantInfo = variant
            ? ` (${variant.variant_type}: ${variant.variant_value})`
            : '';
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}${variantInfo}. Disponible: ${currentStock}, Solicitado: ${requestedQty}`,
          );
        }
      }

      // Si el producto tiene seriales, validar que haya suficientes disponibles
      if (!isWeightProduct) {
        const productSerials = await this.dataSource.getRepository(ProductSerial).find({
          where: { product_id: product.id },
        });

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
    // Usar SELECT FOR UPDATE para bloquear la fila durante la transacción
    const result = await manager.query(
      `SELECT stock, reserved
       FROM warehouse_stock
       WHERE warehouse_id = $1
         AND product_id = $2
         AND (($3::uuid IS NULL AND variant_id IS NULL) OR variant_id = $3::uuid)
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
    // Bloquear todas las filas de stock para este producto en todas las bodegas de la tienda
    const result = await manager.query(
      `SELECT COALESCE(SUM(stock - COALESCE(reserved, 0)), 0) as total_available
       FROM warehouse_stock ws
       INNER JOIN warehouses w ON ws.warehouse_id = w.id
       WHERE w.store_id = $1
         AND ws.product_id = $2
         AND (($3::uuid IS NULL AND ws.variant_id IS NULL) OR ws.variant_id = $3::uuid)
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
  ) {}

  async create(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
    userRole?: string,
  ): Promise<Sale> {
    // ⚙️ VALIDAR CONFIGURACIÓN DEL SISTEMA ANTES DE GENERAR VENTA
    const canGenerate = await this.configValidationService.canGenerateSale(
      storeId,
    );

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
    await this.validateStockAvailability(storeId, dto, userId);

    // ⚠️ VALIDACIÓN DE CRÉDITO FIAO (antes de la transacción)
    // Calcular total aproximado para validación (sin descuentos de promoción aún)
    if (dto.payment_method === 'FIAO') {
      // Calcular subtotal aproximado para validación rápida
      let approximateTotalUsd = 0;
      for (const item of dto.items) {
        const product = await this.productRepository.findOne({
          where: { id: item.product_id, store_id: storeId },
        });
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
    }

    // Usar transacción con retry logic para deadlocks
    const saleWithDebt = await this.transactionWithRetry(async (manager) => {
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
      const saleId = randomUUID();
      const soldAt = new Date();

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

      // Obtener productos y calcular totales
      const productMap = new Map<string, Product>();
      const items: SaleItem[] = [];
      let subtotalBs = 0;
      let subtotalUsd = 0;
      let netSubtotalBs = 0;
      let netSubtotalUsd = 0;
      let discountBs = 0;
      let discountUsd = 0;

      // Procesar cada item del carrito
      for (const cartItem of dto.items) {
        const product = await manager.findOne(Product, {
          where: {
            id: cartItem.product_id,
            store_id: storeId,
            is_active: true,
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto ${cartItem.product_id} no encontrado o inactivo`,
          );
        }

        productMap.set(product.id, product);

        // Manejar variante si se proporciona
        let variant: ProductVariant | null = null;
        if (cartItem.variant_id) {
          variant = await manager.findOne(ProductVariant, {
            where: { id: cartItem.variant_id, product_id: product.id },
          });

          if (!variant) {
            throw new NotFoundException(
              `Variante ${cartItem.variant_id} no encontrada para el producto ${product.name}`,
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

        if (!isWeightProduct) {
          // Verificar si el producto tiene seriales
          const productSerials = await manager.find(ProductSerial, {
            where: { product_id: product.id },
          });

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

            // Nota: Los seriales se asignan después de la venta mediante el endpoint de asignación
            // Esto permite flexibilidad para escanear seriales después de crear la venta
          }
        }

        // Verificar si el producto tiene lotes
        const productLots = await manager.find(ProductLot, {
          where: { product_id: product.id },
        });

        let lotId: string | null = null;

        // Si el producto tiene lotes, usar lógica FIFO
        if (productLots.length > 0) {
          // ⚠️ VALIDACIÓN CON LOCK: Bloquear lotes con SELECT FOR UPDATE
          const lockedLots = await manager
            .createQueryBuilder(ProductLot, 'lot')
            .where('lot.product_id = :productId', { productId: product.id })
            .andWhere('lot.remaining_quantity > 0')
            .setLock('pessimistic_write')
            .getMany();

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
        const discountPercentage =
          subtotalBs > 0
            ? (discountBs / subtotalBs) * 100
            : subtotalUsd > 0
              ? (discountUsd / subtotalUsd) * 100
              : 0;

        const discountValidation =
          await this.discountRulesService.requiresAuthorization(
            storeId,
            discountBs,
            discountUsd,
            discountPercentage,
          );

        // Si requiere autorización y no está auto-aprobado, lanzar error
        if (
          discountValidation.requires_authorization &&
          !discountValidation.auto_approved
        ) {
          throw new BadRequestException(
            discountValidation.error ||
              'Este descuento requiere autorización de un supervisor',
          );
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
      } catch (error) {
        // Si no hay series configuradas, la venta se crea sin número de factura
        // Esto permite que el sistema funcione aunque no se hayan configurado series
        this.logger.warn(
          'No se pudo generar número de factura',
          error instanceof Error ? error.stack : String(error),
        );
      }

      const saleNumber = await this.getNextSaleNumber(manager, storeId);

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
        sold_by_user_id: userId || null,
        note: dto.note || null,
        invoice_series_id: invoiceSeriesId,
        invoice_number: invoiceNumber,
        invoice_full_number: invoiceFullNumber,
      });

      const savedSale = await manager.save(Sale, sale);

      // Guardar items
      await manager.save(SaleItem, items);

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

      // Crear movimientos de inventario (descontar stock)
      // Solo si el producto NO tiene lotes (los lotes ya se manejaron arriba)
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

          await manager.save(InventoryMovement, movement);

          // Actualizar stock de la bodega si se especificó
          if (warehouseId) {
            await this.warehousesService.updateStock(
              warehouseId,
              item.product_id,
              item.variant_id || null,
              -item.qty, // Negativo para descontar
              storeId,
            );
          }
        }
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
          saleWithDebt.debt.remaining_bs =
            Number(debtWithPayments.amount_bs) - totalPaidBs;
          saleWithDebt.debt.remaining_usd =
            Number(debtWithPayments.amount_usd) - totalPaidUsd;
        }
      }

      // Agregar información de factura fiscal si existe (después de la transacción)
      // Nota: La factura fiscal se crea después de la venta
      saleWithDebt.fiscal_invoice = null;

      return saleWithDebt;
    });

    let fiscalInvoiceIssued = false;
    let fiscalInvoiceFound = false;
    try {
      const hasFiscalConfig =
        await this.fiscalInvoicesService.hasActiveFiscalConfig(storeId);
      if (hasFiscalConfig) {
        const existingInvoice = await this.fiscalInvoicesService.findBySale(
          storeId,
          saleWithDebt.id,
        );
        if (existingInvoice) {
          fiscalInvoiceFound = true;
          if (existingInvoice.status === 'draft') {
            const issuedInvoice = await this.fiscalInvoicesService.issue(
              storeId,
              existingInvoice.id,
            );
            fiscalInvoiceIssued = issuedInvoice.status === 'issued';
            saleWithDebt.fiscal_invoice = {
              id: issuedInvoice.id,
              invoice_number: issuedInvoice.invoice_number,
              fiscal_number: issuedInvoice.fiscal_number,
              status: issuedInvoice.status,
              issued_at: issuedInvoice.issued_at,
            };
          } else {
            fiscalInvoiceIssued = existingInvoice.status === 'issued';
            saleWithDebt.fiscal_invoice = {
              id: existingInvoice.id,
              invoice_number: existingInvoice.invoice_number,
              fiscal_number: existingInvoice.fiscal_number,
              status: existingInvoice.status,
              issued_at: existingInvoice.issued_at,
            };
          }
        } else {
          const createdInvoice = await this.fiscalInvoicesService.createFromSale(
            storeId,
            saleWithDebt.id,
            userId || null,
          );
          const issuedInvoice = await this.fiscalInvoicesService.issue(
            storeId,
            createdInvoice.id,
          );
          fiscalInvoiceIssued = issuedInvoice.status === 'issued';
          fiscalInvoiceFound = true;
          saleWithDebt.fiscal_invoice = {
            id: issuedInvoice.id,
            invoice_number: issuedInvoice.invoice_number,
            fiscal_number: issuedInvoice.fiscal_number,
            status: issuedInvoice.status,
            issued_at: issuedInvoice.issued_at,
          };
        }
      }
    } catch (error) {
      this.logger.error(
        `Error emitiendo factura fiscal automática para venta ${saleWithDebt.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    if (!fiscalInvoiceIssued && !fiscalInvoiceFound) {
      try {
        await this.accountingService.generateEntryFromSale(storeId, saleWithDebt);
      } catch (error) {
        // Log error pero no fallar la venta
        this.logger.error(
          `Error generando asiento contable para venta ${saleWithDebt.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
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
            select: ['id', 'sale_id', 'status', 'amount_bs', 'amount_usd'],
          } as any)
        : [];

    // Mapear deudas por sale_id
    const debtsBySaleId = new Map<string, any>();
    for (const debt of debts) {
      if (debt.sale_id) {
        debtsBySaleId.set(debt.sale_id, debt);
      }
    }

    // Asignar deudas a las ventas
    for (const sale of sales) {
      (sale as any).debt = debtsBySaleId.get(sale.id) || null;
    }

    // Asegurar que items siempre sea un array (incluso si está vacío)
    for (const sale of sales) {
      if (!sale.items) {
        sale.items = [];
      }
    }

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
        saleWithDebt.debt.remaining_bs =
          Number(saleWithDebt.debt.amount_bs || 0) - totalPaidBs;
        saleWithDebt.debt.remaining_usd =
          Number(saleWithDebt.debt.amount_usd || 0) - totalPaidUsd;
      }
      return saleWithDebt;
    });

    return { sales: salesWithDebtInfo, total };
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

      const fiscalInvoice = await this.fiscalInvoicesService.findBySale(
        storeId,
        saleId,
      );
      if (fiscalInvoice && fiscalInvoice.status === 'issued') {
        throw new BadRequestException(
          'La venta tiene una factura fiscal emitida. Debe anularse con una nota de crédito.',
        );
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

      return manager.save(Sale, sale);
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

      const fiscalInvoice = await this.fiscalInvoicesService.findBySale(
        storeId,
        saleId,
      );
      if (fiscalInvoice && fiscalInvoice.status === 'issued') {
        throw new BadRequestException(
          'La venta tiene una factura fiscal emitida. Debe anularse con una nota de crédito.',
        );
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
