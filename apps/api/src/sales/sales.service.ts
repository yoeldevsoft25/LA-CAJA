import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
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
import { randomUUID } from 'crypto';
import { CashSession } from '../database/entities/cash-session.entity';
import { IsNull } from 'typeorm';
import { PaymentRulesService } from '../payments/payment-rules.service';
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

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

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
  ) {}

  async create(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
  ): Promise<Sale> {
    // Validar que hay items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito no puede estar vacío');
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
    const openSession = await this.cashSessionRepository.findOne({
      where: { store_id: storeId, closed_at: IsNull() },
    });

    if (!openSession) {
      throw new BadRequestException(
        'No hay una sesión de caja abierta. Abre caja para registrar ventas.',
      );
    }

    // Si se envía cash_session_id debe coincidir con la sesión abierta
    if (dto.cash_session_id && dto.cash_session_id !== openSession.id) {
      throw new BadRequestException(
        'La venta debe asociarse a la sesión de caja abierta actual.',
      );
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

        // Verificar si el producto tiene seriales
        const productSerials = await manager.find(ProductSerial, {
          where: { product_id: product.id },
        });

        // Si el producto tiene seriales, validar que haya suficientes disponibles
        if (productSerials.length > 0) {
          const availableSerials = productSerials.filter(
            (s) => s.status === 'available',
          );

          if (availableSerials.length < cartItem.qty) {
            throw new BadRequestException(
              `No hay suficientes seriales disponibles para ${product.name}. Disponibles: ${availableSerials.length}, Solicitados: ${cartItem.qty}`,
            );
          }

          // Nota: Los seriales se asignan después de la venta mediante el endpoint de asignación
          // Esto permite flexibilidad para escanear seriales después de crear la venta
        }

        // Verificar si el producto tiene lotes
        const productLots = await manager.find(ProductLot, {
          where: { product_id: product.id },
        });

        let lotId: string | null = null;

        // Si el producto tiene lotes, usar lógica FIFO
        if (productLots.length > 0) {
          // Filtrar lotes disponibles (con stock)
          const availableLots = productLots.filter(
            (lot) => lot.remaining_quantity > 0,
          );

          if (availableLots.length === 0) {
            throw new BadRequestException(
              `No hay stock disponible en lotes para ${product.name}`,
            );
          }

          // Obtener asignación FIFO
          const allocations = this.inventoryRulesService.getLotsForSale(
            product.id,
            cartItem.qty,
            availableLots,
          );

          // Usar el primer lote asignado (puede haber múltiples si se agota uno)
          // En una implementación más completa, podríamos crear múltiples sale_items
          // uno por cada lote asignado, pero por simplicidad usamos el primero
          lotId = allocations[0]?.lot_id || null;

          // Actualizar remaining_quantity de los lotes asignados
          for (const allocation of allocations) {
            const lot = availableLots.find((l) => l.id === allocation.lot_id);
            if (lot) {
              lot.remaining_quantity -= allocation.quantity;
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
          // Si no tiene lotes, verificar stock normal (por variante si aplica)
          const currentStock = variant
            ? await this.productVariantsService.getVariantStock(
                storeId,
                variant.id,
              )
            : await this.getCurrentStock(storeId, product.id);

          if (currentStock < cartItem.qty) {
            const variantInfo = variant
              ? ` (${variant.variant_type}: ${variant.variant_value})`
              : '';
            throw new BadRequestException(
              `Stock insuficiente para ${product.name}${variantInfo}. Disponible: ${currentStock}, Solicitado: ${cartItem.qty}`,
            );
          }
        }

        // Calcular precios
        // Primero intentar obtener precio de lista de precio
        let priceBs = variant?.price_bs ?? product.price_bs;
        let priceUsd = variant?.price_usd ?? product.price_usd;

        if (dto.price_list_id) {
          const listPrice = await this.priceListsService.getProductPrice(
            storeId,
            product.id,
            variant?.id || null,
            cartItem.qty,
            dto.price_list_id,
          );

          if (listPrice) {
            priceBs = listPrice.price_bs;
            priceUsd = listPrice.price_usd;
          }
        }

        const itemDiscountBs = cartItem.discount_bs || 0;
        const itemDiscountUsd = cartItem.discount_usd || 0;
        const itemSubtotalBs = priceBs * cartItem.qty - itemDiscountBs;
        const itemSubtotalUsd = priceUsd * cartItem.qty - itemDiscountUsd;

        subtotalBs += itemSubtotalBs;
        subtotalUsd += itemSubtotalUsd;
        discountBs += itemDiscountBs;
        discountUsd += itemDiscountUsd;

        // Crear sale item
        const saleItem = manager.create(SaleItem, {
          id: randomUUID(),
          sale_id: saleId,
          product_id: product.id,
          variant_id: variant?.id || null,
          lot_id: lotId,
          qty: cartItem.qty,
          unit_price_bs: priceBs,
          unit_price_usd: priceUsd,
          discount_bs: itemDiscountBs,
          discount_usd: itemDiscountUsd,
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
          subtotalBs,
          subtotalUsd,
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
            subtotalBs,
            subtotalUsd,
          );

        promotionDiscountBs = promotionDiscount.discount_bs;
        promotionDiscountUsd = promotionDiscount.discount_usd;

        // Agregar descuento de promoción a los descuentos totales
        discountBs += promotionDiscountBs;
        discountUsd += promotionDiscountUsd;
      }

      // Calcular totales
      const totalBs = subtotalBs - discountBs;
      const totalUsd = subtotalUsd - discountUsd;

      // Validar descuentos si hay alguno
      if (discountBs > 0 || discountUsd > 0) {
        // Calcular porcentaje de descuento basado en el subtotal original
        const originalSubtotalBs = subtotalBs + discountBs;
        const originalSubtotalUsd = subtotalUsd + discountUsd;
        const discountPercentage =
          originalSubtotalBs > 0
            ? (discountBs / originalSubtotalBs) * 100
            : originalSubtotalUsd > 0
              ? (discountUsd / originalSubtotalUsd) * 100
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

      // Validar método de pago según configuración de topes
      if (dto.payment_method === 'SPLIT' && dto.split) {
        // Validar pago split
        const splitValidation =
          await this.paymentRulesService.validateSplitPayment(
            storeId,
            dto.split,
          );
        if (!splitValidation.valid) {
          throw new BadRequestException(splitValidation.error);
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
        console.warn('No se pudo generar número de factura:', error);
      }

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

      // Determinar bodega de venta
      let warehouseId: string | null = null;
      if (dto.warehouse_id) {
        // Validar que la bodega existe y pertenece a la tienda
        await this.warehousesService.findOne(storeId, dto.warehouse_id);
        warehouseId = dto.warehouse_id;
      } else {
        // Usar bodega por defecto si no se especifica
        const defaultWarehouse =
          await this.warehousesService.getDefault(storeId);
        if (defaultWarehouse) {
          warehouseId = defaultWarehouse.id;
        }
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
            );
          }
        }
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
          saleWithDebt.debt.remaining_bs =
            Number(debtWithPayments.amount_bs) - totalPaidBs;
          saleWithDebt.debt.remaining_usd =
            Number(debtWithPayments.amount_usd) - totalPaidUsd;
        }
      }

      // Agregar información de factura fiscal si existe (después de la transacción)
      // Nota: La factura fiscal se crea después de la venta, así que aquí será null
      saleWithDebt.fiscal_invoice = null;

      // Generar asiento contable automático
      try {
        await this.accountingService.generateEntryFromSale(storeId, savedSaleWithItems);
      } catch (error) {
        // Log error pero no fallar la venta
        this.logger.error(
          `Error generando asiento contable para venta ${saleId}`,
          error instanceof Error ? error.stack : String(error),
        );
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

  private async getCurrentStock(
    storeId: string,
    productId: string,
  ): Promise<number> {
    const result = await this.movementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', { productId })
      .getRawOne();

    return parseInt(result.stock, 10) || 0;
  }
}
