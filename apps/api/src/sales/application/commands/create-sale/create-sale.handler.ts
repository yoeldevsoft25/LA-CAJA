import {
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Sale } from '../../../../database/entities/sale.entity';
import { SaleItem } from '../../../../database/entities/sale-item.entity';
import { Product } from '../../../../database/entities/product.entity';
import { InventoryMovement } from '../../../../database/entities/inventory-movement.entity';
import { Customer } from '../../../../database/entities/customer.entity';
import { Debt, DebtStatus } from '../../../../database/entities/debt.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { CreateSaleDto } from '../../../dto/create-sale.dto';
import { randomUUID } from 'crypto';
import { CashSession } from '../../../../database/entities/cash-session.entity';
import { Event } from '../../../../database/entities/event.entity';
import {
  PaymentRulesService,
  PaymentSplit,
} from '../../../../payments/payment-rules.service';
import {
  DiscountRulesService,
  DiscountValidationResult,
} from '../../../../discounts/discount-rules.service';

import { ProductVariant } from '../../../../database/entities/product-variant.entity';
import { ProductVariantsService } from '../../../../product-variants/product-variants.service';
import { ProductLot } from '../../../../database/entities/product-lot.entity';
import { LotMovement } from '../../../../database/entities/lot-movement.entity';
import { ProductLotsService } from '../../../../product-lots/product-lots.service';
import { InventoryRulesService } from '../../../../product-lots/inventory-rules.service';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { ProductSerialsService } from '../../../../product-serials/product-serials.service';
import { InvoiceSeriesService } from '../../../../invoice-series/invoice-series.service';
import { PriceListsService } from '../../../../price-lists/price-lists.service';
import { PromotionsService } from '../../../../promotions/promotions.service';
import { WarehousesService } from '../../../../warehouses/warehouses.service';
import { FiscalInvoicesService } from '../../../../fiscal-invoices/fiscal-invoices.service';
import { AccountingService } from '../../../../accounting/accounting.service';

import { SaleReturn } from '../../../../database/entities/sale-return.entity';
import { SaleReturnItem } from '../../../../database/entities/sale-return-item.entity';
import { SecurityAuditService } from '../../../../security/security-audit.service';
import { UsageService } from '../../../../licenses/usage.service';
import { CreateSaleCommand } from './create-sale.command';
import { CreateSaleValidator } from './create-sale.validator';

@CommandHandler(CreateSaleCommand)
export class CreateSaleHandler implements ICommandHandler<CreateSaleCommand> {
  private readonly logger = new Logger(CreateSaleHandler.name);

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
      } catch (error: unknown) {
        // Código de error PostgreSQL para deadlock
        const err = error as { code?: string; message?: string };
        const isDeadlock =
          err?.code === '40P01' ||
          err?.message?.includes('deadlock') ||
          err?.message?.includes('Deadlock');

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

  /**
   * Crea un registro de deuda para ventas FIAO
   * Valida crédito disponible y crea el registro de deuda
   * @returns El registro de deuda creado o null si no es FIAO
   */
  private async createDebtRecord(
    manager: EntityManager,
    storeId: string,
    saleId: string,
    customerId: string,
    totalUsd: number,
    totalBs: number,
    exchangeRate: number,
  ): Promise<Debt | null> {
    // Validar que el cliente existe
    const customer = await manager.findOne(Customer, {
      where: { id: customerId, store_id: storeId },
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
      [storeId, customerId],
    );

    const currentDebt = parseFloat(debtResult[0]?.current_debt || '0');
    const availableCredit = Number(customer.credit_limit) - currentDebt;

    // Validar que el crédito disponible sea suficiente
    if (totalUsd > availableCredit) {
      throw new BadRequestException(
        `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} USD, Requerido: $${totalUsd.toFixed(2)} USD`,
      );
    }

    // Crear registro de deuda
    const debt = manager.create(Debt, {
      id: randomUUID(),
      store_id: storeId,
      customer_id: customerId,
      sale_id: saleId,
      amount_usd: totalUsd,
      amount_bs: totalBs,
      exchange_rate: exchangeRate,
      status: DebtStatus.OPEN,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await manager.save(Debt, debt);
    return debt;
  }

  /**
   * Determina la bodega de venta
   * Usa la bodega especificada o la bodega por defecto
   * @returns ID de la bodega a usar
   */
  private async prepareWarehouse(
    storeId: string,
    warehouseId?: string | null,
  ): Promise<string> {
    if (warehouseId) {
      // Validar que la bodega existe y pertenece a la tienda
      await this.warehousesService.findOne(storeId, warehouseId);
      return warehouseId;
    } else {
      // Usar bodega por defecto si no se especifica
      const defaultWarehouse =
        await this.warehousesService.getDefaultOrFirst(storeId);
      return defaultWarehouse.id;
    }
  }

  /**
   * Prepara la información del cliente para la venta
   * Busca, crea o actualiza el cliente según los datos proporcionados
   * @returns ID del cliente final o null si no se proporciona
   */
  private async prepareCustomerData(
    manager: EntityManager,
    storeId: string,
    dto: CreateSaleDto,
  ): Promise<string | null> {
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
        if (dto.customer_name) customer.name = dto.customer_name;
        if (dto.customer_phone !== undefined)
          customer.phone = dto.customer_phone || null;
        if (dto.customer_note !== undefined)
          customer.note = dto.customer_note || null;
        customer.updated_at = new Date();
        await manager.save(Customer, customer);
        finalCustomerId = customer.id;
      }
      // Si no existe, crearlo
      else if (dto.customer_name && dto.customer_document_id) {
        const newCustomer = manager.create(Customer, {
          id: randomUUID(),
          store_id: storeId,
          name: dto.customer_name,
          document_id: dto.customer_document_id.trim(),
          phone: dto.customer_phone || null,
          note: dto.customer_note || null,
          created_at: new Date(),
          updated_at: new Date(),
        });
        await manager.save(Customer, newCustomer);
        finalCustomerId = newCustomer.id;
      }
    }

    return finalCustomerId;
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
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private dataSource: DataSource,
    private paymentRulesService: PaymentRulesService,
    private discountRulesService: DiscountRulesService,
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
    private securityAuditService: SecurityAuditService,
    private usageService: UsageService,
    private validator: CreateSaleValidator,
    @InjectQueue('sales-post-processing')
    private salesPostProcessingQueue: Queue,
    @InjectQueue('federation-sync')
    private federationSyncQueue: Queue,
  ) {}

  async execute(command: CreateSaleCommand): Promise<Sale> {
    const { storeId, dto, userId, userRole, returnMode } = command;
    const startTime = Date.now();
    const effectiveUserRole = userRole || 'cashier';

    // ⚠️ VALIDACIONES INICIALES
    const openSession = await this.validator.validateSaleRequest(
      storeId,
      dto,
      userId,
    );

    // Forzar asociación a la sesión abierta
    dto.cash_session_id = openSession.id;

    // ⚠️ VALIDACIÓN INICIAL DE STOCK (antes de la transacción para rechazar rápidamente)
    // Esta es una validación rápida sin locks. La validación definitiva con locks se hace dentro de la transacción.
    const warehouseId = await this.prepareWarehouse(storeId, dto.warehouse_id);
    await this.validator.validateStockAvailability(storeId, dto, warehouseId);

    // ⚠️ VALIDACIÓN DE CRÉDITO FIAO (antes de la transacción)
    // Calcular total aproximado para validación (sin descuentos de promoción aún)
    if (dto.payment_method === 'FIAO') {
      // ⚡ OPTIMIZACIÓN: Batch query en lugar de N+1 queries
      const productIds = dto.items.map((item) => item.product_id);
      const products = await this.productRepository.find({
        where: {
          id: In(productIds),
          store_id: storeId,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      let totalUsd = 0;

      for (const item of dto.items) {
        const product = productMap.get(item.product_id);
        if (product) {
          const isWeightProduct = Boolean(
            item.is_weight_product || product.is_weight_product,
          );
          const qty = isWeightProduct
            ? Number(item.weight_value ?? item.qty ?? 0)
            : Number(item.qty ?? 0);
          const price = isWeightProduct
            ? Number(item.price_per_weight_usd ?? product.price_per_weight_usd ?? 0)
            : Number(product.price_usd ?? 0);
          const discountUsd = item.discount_usd || 0;
          totalUsd += price * qty - discountUsd;
        }
      }

      await this.validator.validateFIAOCredit(storeId, dto, totalUsd);
    }

    // Usar transacción con retry logic para deadlocks
    // Interfaz para el resultado de la transacción (unificada)
    interface DetailedDebt {
      id: string;
      status: string;
      amount_bs: number;
      amount_usd: number;
      total_paid_bs?: number;
      total_paid_usd?: number;
      remaining_bs?: number;
      remaining_usd?: number;
    }

    type SaleResponse = Sale & {
      debt?: DetailedDebt | null;
      items?: SaleItem[];
      fiscal_invoice?:
        | import('../../../../database/entities/fiscal-invoice.entity').FiscalInvoice
        | null;
    };

    const result = await this.transactionWithRetry<SaleResponse>(
      async (manager) => {
        // Manejar información del cliente
        const finalCustomerId = await this.prepareCustomerData(
          manager,
          storeId,
          dto,
        );

        const saleId = randomUUID();
        const soldAt = new Date();

        // Determinar bodega de venta
        const warehouseId = await this.prepareWarehouse(
          storeId,
          dto.warehouse_id,
        );

        // ⚡ OPTIMIZACIÓN: Obtener todos los productos en una sola query batch

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

        const productsWithSerials = productIds.filter((id) => {
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

            const lockedLots = await manager
              .createQueryBuilder(ProductLot, 'lot')
              .where('lot.product_id = :productId', { productId: product.id })
              .andWhere('lot.remaining_quantity > 0')
              .orderBy('lot.expiration_date', 'ASC', 'NULLS LAST') // FIFO: lotes más antiguos primero
              .setLock('pessimistic_write', undefined, ['SKIP LOCKED'])
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
                lot.remaining_quantity =
                  Number(lot.remaining_quantity) - allocation.quantity;
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
              ? await this.validator.validateAndLockStock(
                  manager,
                  storeId,
                  warehouseId,
                  product.id,
                  variant?.id || null,
                  requestedQty,
                )
              : await this.validator.validateAndLockTotalStock(
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

          const effectiveQty = requestedQty;
          let itemSubtotalBs = 0;
          let itemSubtotalUsd = 0;

          if (isWeightProduct) {
            const pricePerWeightBs =
              cartItem.price_per_weight_bs ?? product.price_per_weight_bs ?? 0;
            const pricePerWeightUsd =
              cartItem.price_per_weight_usd ??
              product.price_per_weight_usd ??
              0;

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
              ? (cartItem.price_per_weight_bs ??
                product.price_per_weight_bs ??
                null)
              : null,
            price_per_weight_usd: isWeightProduct
              ? (cartItem.price_per_weight_usd ??
                product.price_per_weight_usd ??
                null)
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

          discountValidation =
            await this.discountRulesService.requiresAuthorization(
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
            const config =
              await this.discountRulesService.getOrCreateConfig(storeId);
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
            ? dto.split ||
              this.buildSplitSummary(dto.split_payments, dto.exchange_rate)
            : dto.split;

        // Validar método de pago según configuración de topes
        if (dto.payment_method === 'SPLIT') {
          if (
            !splitSummary &&
            (!dto.split_payments || dto.split_payments.length === 0)
          ) {
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
          const validation =
            await this.paymentRulesService.validatePaymentMethod(
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
          sold_by_user_id: userId, // Ya validado arriba que userId no puede ser null/undefined
          note: dto.note || null,
          invoice_series_id: invoiceSeriesId,
          invoice_number: invoiceNumber,
          invoice_full_number: invoiceFullNumber,
        });

        const savedSale = await manager.save(Sale, sale);

        // Guardar items

        await manager.save(SaleItem, items);

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
          // Aunque tenga lote (ya manejado en LotMovement), DEBEMOS crear InventoryMovement
          // y actualizar warehouse_stock para mantener la consistencia del stock agregado
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
            ref: {
              sale_id: saleId,
              warehouse_id: warehouseId,
              lot_id: item.lot_id || undefined,
            },
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

        // ⚡ OPTIMIZACIÓN: Batch save de movimientos
        if (movementsToCreate.length > 0) {
          await manager.save(InventoryMovement, movementsToCreate);
        }

        // ⚡ OPTIMIZACIÓN CRÍTICA: Batch update de stocks (reduce de N queries a 1-2 queries)
        if (warehouseId && stockUpdates.length > 0) {
          await this.warehousesService.updateStockBatch(
            warehouseId,
            stockUpdates,
            storeId,
            manager,
          );
        }

        // ⚠️ VALIDACIÓN CRÍTICA: Si es venta FIAO, DEBE haber un cliente válido
        if (dto.payment_method === 'FIAO' && !finalCustomerId) {
          throw new BadRequestException(
            'Las ventas FIAO requieren un cliente válido. No se puede procesar la venta sin identificar al cliente.',
          );
        }

        // Si es venta FIAO, crear la deuda automáticamente
        let debt: Debt | null = null;
        if (dto.payment_method === 'FIAO' && finalCustomerId) {
          debt = await this.createDebtRecord(
            manager,
            storeId,
            saleId,
            finalCustomerId,
            totalUsd,
            totalBs,
            dto.exchange_rate,
          );
        }

        if (returnMode === 'minimal') {
          // Respuesta mínima para acelerar el checkout (sin joins pesados)
          type MinimalProduct = {
            id: string;
            name: string;
            sku: string | null;
            barcode: string | null;
          };
          type MinimalItem = Omit<SaleItem, 'product'> & {
            product?: MinimalProduct | null;
          };

          for (const item of items) {
            const product = productMap.get(item.product_id);
            const itemWithProduct = item as unknown as MinimalItem;
            if (product && !itemWithProduct.product) {
              itemWithProduct.product = {
                id: product.id,
                name: product.name,
                sku: product.sku || null,
                barcode: product.barcode || null,
              };
            }
          }

          type MinimalDebt = {
            id: string;
            status: string;
            amount_bs: number;
            amount_usd: number;
            total_paid_bs: number;
            total_paid_usd: number;
            remaining_bs: number;
            remaining_usd: number;
          };
          type MinimalSale = Sale & {
            items: SaleItem[];
            debt: MinimalDebt | null;
            fiscal_invoice: null;
          };

          const minimalSale = savedSale as MinimalSale;
          minimalSale.items = items;
          minimalSale.debt = debt
            ? {
                id: debt.id,
                status: debt.status,
                amount_bs: Number(debt.amount_bs || 0),
                amount_usd: Number(debt.amount_usd || 0),
                total_paid_bs: 0,
                total_paid_usd: 0,
                remaining_bs: Number(debt.amount_bs || 0),
                remaining_usd: Number(debt.amount_usd || 0),
              }
            : null;
          minimalSale.fiscal_invoice = null;
          return minimalSale;
        }

        // ⚡ OPTIMIZACIÓN: Query simplificada con todos los datos necesarios en una sola query
        // Incluir payments en el JOIN para evitar query adicional

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

        if (!savedSaleWithItems) {
          throw new Error('Error al recuperar la venta creada');
        }

        // ⚡ OPTIMIZACIÓN: Calcular pagos desde los datos ya cargados (sin query adicional)
        type DetailedDebt = {
          id: string;
          status: string;
          amount_bs: number;
          amount_usd: number;
          total_paid_bs?: number;
          total_paid_usd?: number;
          remaining_bs?: number;
          remaining_usd?: number;
        };
        type SaleWithDetailedDebt = Sale & {
          debt?: DetailedDebt | null;
          fiscal_invoice?:
            | import('../../../../database/entities/fiscal-invoice.entity').FiscalInvoice
            | null;
        };

        const saleWithDetailedDebt = savedSaleWithItems as SaleWithDetailedDebt;
        if (saleWithDetailedDebt.debt) {
          // Los payments ya están en el resultado del query (aunque TypeORM puede no exponerlos directamente)
          // Si no están disponibles, hacer query solo si es necesario
          const debtId = saleWithDetailedDebt.debt.id;
          if (debtId) {
            const debtWithPayments = await manager
              .createQueryBuilder(Debt, 'debt')
              .leftJoinAndSelect('debt.payments', 'payments')
              .where('debt.id = :debtId', { debtId })
              .getOne();

            if (debtWithPayments) {
              const totalPaidBs = (debtWithPayments.payments || []).reduce(
                (sum: number, p) => sum + Number(p.amount_bs),
                0,
              );
              const totalPaidUsd = (debtWithPayments.payments || []).reduce(
                (sum: number, p) => sum + Number(p.amount_usd),
                0,
              );
              saleWithDetailedDebt.debt.total_paid_bs = totalPaidBs;
              saleWithDetailedDebt.debt.total_paid_usd = totalPaidUsd;
              saleWithDetailedDebt.debt.remaining_bs =
                Number(debtWithPayments.amount_bs) - totalPaidBs;
              saleWithDetailedDebt.debt.remaining_usd =
                Number(debtWithPayments.amount_usd) - totalPaidUsd;
            }
          }
        }

        // Agregar información de factura fiscal si existe (después de la transacción)
        // Nota: La factura fiscal se crea después de la venta
        saleWithDetailedDebt.fiscal_invoice = null;

        return saleWithDetailedDebt;
      },
    );

    const saleWithDetailedDebt = result;

    // ⚡ OPTIMIZACIÓN: Encolar tareas post-venta de forma asíncrona
    // Esto permite retornar la respuesta inmediatamente sin esperar
    // facturas fiscales y asientos contables (que pueden tardar 1-3 segundos)
    try {
      await this.salesPostProcessingQueue.add(
        'post-process-sale',
        {
          storeId,
          saleId: saleWithDetailedDebt.id,
          userId: userId || undefined,
          generateFiscalInvoice: dto.generate_fiscal_invoice || false,
        },
        {
          priority: 5, // Prioridad media para tareas post-venta
          jobId: `post-process-${saleWithDetailedDebt.id}`, // Evitar duplicados
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
        `Tareas post-venta encoladas para venta ${saleWithDetailedDebt.id}`,
      );
    } catch (error) {
      // Log error pero no fallar la venta
      this.logger.error(
        `Error encolando tareas post-venta para venta ${saleWithDetailedDebt.id}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Retornar venta inmediatamente (sin factura fiscal ni asiento contable)
    // Estos se procesarán en background
    saleWithDetailedDebt.fiscal_invoice = null; // Se agregará cuando se procese en background

    const duration = Date.now() - startTime;
    this.logger.log(
      `[SALE_CREATE] ✅ Venta creada exitosamente - ID: ${saleWithDetailedDebt.id}, Duración: ${duration}ms, Items: ${dto.items?.length || 0}`,
    );

    // Métricas de performance
    if (duration > 1000) {
      this.logger.warn(
        `[SALE_CREATE] ⚠️ Venta tardó ${duration}ms (objetivo: <500ms) - Store: ${storeId}`,
      );
    }

    await this.usageService.increment(storeId, 'invoices_per_month');

    // Crear evento SaleCreated para habilitar federación entre APIs incluso cuando
    // la venta se creó por /sales (flujo online directo, sin /sync/push).
    try {
      const serverDeviceId = '00000000-0000-0000-0000-000000000001';
      const eventSeq = Date.now();
      const saleEvent = this.eventRepository.create({
        event_id: randomUUID(),
        store_id: storeId,
        device_id: serverDeviceId,
        seq: eventSeq,
        type: 'SaleCreated',
        version: 1,
        created_at: new Date(saleWithDetailedDebt.sold_at),
        actor_user_id: userId || null,
        actor_role: effectiveUserRole || 'cashier',
        payload: {
          sale_id: saleWithDetailedDebt.id,
          cash_session_id: saleWithDetailedDebt.cash_session_id,
          sold_at: new Date(saleWithDetailedDebt.sold_at).getTime(),
          exchange_rate: Number(saleWithDetailedDebt.exchange_rate),
          currency: saleWithDetailedDebt.currency,
          items: (saleWithDetailedDebt.items || []).map((item) => ({
            line_id: item.id,
            product_id: item.product_id,
            qty: Number(item.qty),
            unit_price_bs: Number(item.unit_price_bs),
            unit_price_usd: Number(item.unit_price_usd),
            discount_bs: Number(item.discount_bs || 0),
            discount_usd: Number(item.discount_usd || 0),
            is_weight_product: Boolean(item.is_weight_product),
            weight_unit: item.weight_unit || null,
            weight_value:
              item.weight_value === null || item.weight_value === undefined
                ? null
                : Number(item.weight_value),
            price_per_weight_bs:
              item.price_per_weight_bs === null ||
              item.price_per_weight_bs === undefined
                ? null
                : Number(item.price_per_weight_bs),
            price_per_weight_usd:
              item.price_per_weight_usd === null ||
              item.price_per_weight_usd === undefined
                ? null
                : Number(item.price_per_weight_usd),
          })),
          totals: {
            subtotal_bs: Number(saleWithDetailedDebt.totals?.subtotal_bs || 0),
            subtotal_usd: Number(saleWithDetailedDebt.totals?.subtotal_usd || 0),
            discount_bs: Number(saleWithDetailedDebt.totals?.discount_bs || 0),
            discount_usd: Number(saleWithDetailedDebt.totals?.discount_usd || 0),
            total_bs: Number(saleWithDetailedDebt.totals?.total_bs || 0),
            total_usd: Number(saleWithDetailedDebt.totals?.total_usd || 0),
          },
          payment: saleWithDetailedDebt.payment,
          customer: saleWithDetailedDebt.customer_id
            ? {
                customer_id: saleWithDetailedDebt.customer_id,
              }
            : undefined,
          note: saleWithDetailedDebt.note || undefined,
        },
        vector_clock: { [serverDeviceId]: eventSeq },
        causal_dependencies: [],
        delta_payload: null,
        full_payload_hash: null,
      });

      await this.eventRepository.save(saleEvent);
      await this.federationSyncQueue.add(
        'relay-event',
        {
          eventId: saleEvent.event_id,
          storeId: saleEvent.store_id,
          deviceId: saleEvent.device_id,
        },
        {
          attempts: 10,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
        },
      );
    } catch (error) {
      this.logger.error(
        `[SALE_CREATE] Error creando/encolando evento de federación para venta ${saleWithDetailedDebt.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return saleWithDetailedDebt;
  }
}
