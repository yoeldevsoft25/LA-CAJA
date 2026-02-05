import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, EntityManager, IsNull, MoreThan } from 'typeorm';
import { CreateSaleDto } from '../../../dto/create-sale.dto';
import { CashSession } from '../../../../database/entities/cash-session.entity';
import { Product } from '../../../../database/entities/product.entity';
import { ProductVariant } from '../../../../database/entities/product-variant.entity';
import { ProductLot } from '../../../../database/entities/product-lot.entity';
import { ProductSerial } from '../../../../database/entities/product-serial.entity';
import { StockEscrow } from '../../../../database/entities/stock-escrow.entity';
import { Customer } from '../../../../database/entities/customer.entity';
import { ConfigValidationService } from '../../../../config/config-validation.service';
import { FastCheckoutRulesService } from '../../../../fast-checkout/fast-checkout-rules.service';

@Injectable()
export class CreateSaleValidator {
  private readonly logger = new Logger(CreateSaleValidator.name);

  constructor(
    private readonly configValidationService: ConfigValidationService,
    private readonly fastCheckoutRulesService: FastCheckoutRulesService,
    @InjectRepository(CashSession)
    private readonly cashSessionRepository: Repository<CashSession>,
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockEscrow)
    private readonly stockEscrowRepository: Repository<StockEscrow>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) { }

  async validateSaleRequest(
    storeId: string,
    dto: CreateSaleDto,
    userId?: string,
  ): Promise<CashSession> {
    // ⚙️ Validar configuración del sistema
    const canGenerate =
      await this.configValidationService.canGenerateSale(storeId);
    if (!canGenerate) {
      const errorMessage =
        await this.configValidationService.getConfigurationErrorMessage(
          storeId,
        );
      throw new BadRequestException(errorMessage);
    }

    // ⚠️ Validar que hay items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('El carrito no puede estar vacío');
    }

    // ⚠️ Validar que todos los items tengan cantidad > 0
    for (const item of dto.items) {
      const qty =
        item.is_weight_product && item.weight_value
          ? Number(item.weight_value)
          : Number(item.qty) || 0;
      if (qty <= 0) {
        throw new BadRequestException(
          `La cantidad debe ser mayor a 0 para el producto ${item.product_id}`,
        );
      }
    }

    // ⚠️ Validar que exchange_rate sea válido
    if (!dto.exchange_rate || dto.exchange_rate <= 0) {
      throw new BadRequestException('La tasa de cambio debe ser mayor a 0');
    }

    // ⚠️ Validar que hay un responsable (userId)
    if (!userId) {
      throw new BadRequestException(
        'Todas las ventas requieren un responsable (cajero). No se puede procesar la venta sin identificar quién la realizó.',
      );
    }

    // ⚠️ Validar FIAO requiere cliente
    if (dto.payment_method === 'FIAO') {
      const hasCustomerId = !!dto.customer_id;
      const hasCustomerData = !!(dto.customer_name && dto.customer_document_id);

      if (!hasCustomerId && !hasCustomerData) {
        throw new BadRequestException(
          'Las ventas FIAO requieren un cliente. Debes proporcionar un customer_id existente o los datos del cliente (nombre y cédula).',
        );
      }
    }

    // Validar modo caja rápida
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

    // Validar sesión de caja abierta
    const openSessionWhere: import('typeorm').FindOptionsWhere<CashSession> = {
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

    // Validar que cash_session_id coincida si se envía
    if (dto.cash_session_id && dto.cash_session_id !== openSession.id) {
      throw new BadRequestException(
        userId
          ? 'La venta debe asociarse a tu sesión de caja abierta actual.'
          : 'La venta debe asociarse a la sesión de caja abierta actual.',
      );
    }

    return openSession;
  }

  async validateStockAvailability(
    storeId: string,
    dto: CreateSaleDto,
    warehouseId: string | null,
  ): Promise<void> {
    if (dto.skip_stock_validation) {
      this.logger.warn(
        `Saltando validación de stock para venta ${dto.request_id || 'unnamed'} por petición del cliente`,
      );
      return;
    }

    const productIds = dto.items.map((item) => item.product_id);
    const variantIds = dto.items
      .map((item) => item.variant_id)
      .filter((id): id is string => !!id);

    const [stockRecords, products, variants, allLots, escrows] = await Promise.all([
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
      this.productRepository.find({
        where: {
          id: In(productIds),
          store_id: storeId,
          is_active: true,
        },
      }),
      variantIds.length > 0
        ? this.dataSource.getRepository(ProductVariant).find({
          where: { id: In(variantIds) },
        })
        : Promise.resolve([]),
      this.dataSource.getRepository(ProductLot).find({
        where: { product_id: In(productIds) },
      }),
      dto.device_id
        ? this.stockEscrowRepository.find({
          where: {
            store_id: storeId,
            device_id: dto.device_id,
            product_id: In(productIds),
            expires_at: MoreThan(new Date()),
          },
        })
        : Promise.resolve([] as StockEscrow[]),
    ]);

    const productsWithSerials = products
      .filter((p) => !p.is_weight_product)
      .map((p) => p.id);
    const allSerials =
      productsWithSerials.length > 0
        ? await this.dataSource.getRepository(ProductSerial).find({
          where: { product_id: In(productsWithSerials) },
        })
        : [];

    const stockMap = new Map<string, number>();
    for (const record of stockRecords) {
      const key = `${record.product_id}:${record.variant_id || 'null'}`;
      const availableStock =
        Number(record.stock || 0) - Number(record.reserved || 0);
      stockMap.set(key, Math.max(0, availableStock));
    }

    // ⚡ POINT 5: Añadir stock reservado en escrows para este dispositivo
    // (Solo cuenta si el escrow no ha expirado y pertenece a este dispositivo)
    for (const escrow of escrows) {
      const key = `${escrow.product_id}:${escrow.variant_id || 'null'}`;
      const current = stockMap.get(key) || 0;
      stockMap.set(key, current + Number(escrow.qty_granted || 0));
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

    for (const cartItem of dto.items) {
      const product = productMap.get(cartItem.product_id);

      if (!product) {
        throw new NotFoundException(
          `Producto ${cartItem.product_id} no encontrado o inactivo`,
        );
      }

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

      const productLots = lotsMap.get(product.id) || [];

      if (productLots.length > 0) {
        const availableLots = productLots.filter(
          (lot) => lot.remaining_quantity > 0,
        );

        if (availableLots.length === 0) {
          throw new BadRequestException(
            `No hay stock disponible en lotes para ${product.name}`,
          );
        }

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
  }

  async validateFIAOCredit(
    storeId: string,
    dto: CreateSaleDto,
    totalUsd: number,
  ): Promise<void> {
    let customerId: string | null = null;

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

    const customer = await this.customerRepository.findOne({
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

    if (availableCredit < totalUsd) {
      throw new BadRequestException(
        `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} USD, Solicitado: $${totalUsd.toFixed(2)} USD`,
      );
    }
  }

  async validateAndLockStock(
    manager: EntityManager,
    storeId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    requestedQty: number,
  ): Promise<number> {
    const result =
      variantId === null
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
      if (requestedQty > 0) {
        throw new BadRequestException(
          `No hay stock disponible para el producto solicitado`,
        );
      }
      return 0;
    }

    const availableStock =
      Number(result[0].stock || 0) - Number(result[0].reserved || 0);
    return Math.max(0, availableStock);
  }

  async validateAndLockTotalStock(
    manager: EntityManager,
    storeId: string,
    productId: string,
    variantId: string | null,
    _requestedQty: number,
  ): Promise<number> {
    const result =
      variantId === null
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
}
