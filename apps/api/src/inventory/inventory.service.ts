import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Product } from '../database/entities/product.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { StockReceivedDto } from './dto/stock-received.dto';
import { StockAdjustedDto } from './dto/stock-adjusted.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { AccountingService } from '../accounting/accounting.service';
import { randomUUID } from 'crypto';
import { GetStockStatusDto } from './dto/get-stock-status.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  private readonly weightUnitToKg: Record<'kg' | 'g' | 'lb' | 'oz', number> = {
    kg: 1,
    g: 0.001,
    lb: 0.45359237,
    oz: 0.028349523125,
  };

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundToDecimals(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private normalizeStartDate(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  private normalizeEndDate(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  private calculateWeightedAverage(
    currentQty: number,
    currentCost: number,
    incomingQty: number,
    incomingCost: number,
  ): number {
    if (incomingQty <= 0) return currentCost;
    if (currentQty <= 0) return incomingCost;
    const totalQty = currentQty + incomingQty;
    if (totalQty <= 0) return incomingCost;
    return (currentQty * currentCost + incomingQty * incomingCost) / totalQty;
  }

  private getPerWeightCostFromBase(
    baseCost: number,
    unit: 'kg' | 'g' | 'lb' | 'oz',
  ): number {
    return baseCost * (this.weightUnitToKg[unit] || 1);
  }

  private getBaseCostFromPerWeight(
    perWeightCost: number,
    unit: 'kg' | 'g' | 'lb' | 'oz',
  ): number {
    const factor = this.weightUnitToKg[unit] || 1;
    return factor > 0 ? perWeightCost / factor : perWeightCost;
  }

  private buildWarehouseStockSubquery(
    storeId: string,
    warehouseId?: string,
  ) {
    const query = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .select('stock.product_id', 'product_id')
      .addSelect('SUM(stock.stock)', 'current_stock')
      .innerJoin(
        'warehouses',
        'warehouse',
        'warehouse.id = stock.warehouse_id AND warehouse.store_id = :storeId',
        { storeId },
      );

    if (warehouseId) {
      query.andWhere('stock.warehouse_id = :warehouseId', { warehouseId });
    }

    return query.groupBy('stock.product_id');
  }

  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(WarehouseStock)
    private warehouseStockRepository: Repository<WarehouseStock>,
    private warehousesService: WarehousesService,
    private accountingService: AccountingService,
  ) {}

  async stockReceived(
    storeId: string,
    dto: StockReceivedDto,
    userId: string,
    role: string,
  ): Promise<InventoryMovement> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Determinar bodega destino
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

    const unitCostBs = this.roundToTwoDecimals(dto.unit_cost_bs);
    const unitCostUsd = this.roundToTwoDecimals(dto.unit_cost_usd);
    const currentStock = await this.getCurrentStock(storeId, dto.product_id);

    // Actualizar costos del producto con costo promedio ponderado
    if (product.is_weight_product) {
      const weightUnit = (product.weight_unit || 'kg') as
        | 'kg'
        | 'g'
        | 'lb'
        | 'oz';
      const currentCostPerWeightUsd =
        product.cost_per_weight_usd ??
        this.getPerWeightCostFromBase(Number(product.cost_usd || 0), weightUnit);
      const currentCostPerWeightBs =
        product.cost_per_weight_bs ??
        this.getPerWeightCostFromBase(Number(product.cost_bs || 0), weightUnit);

      const avgCostPerWeightUsd = this.calculateWeightedAverage(
        currentStock,
        Number(currentCostPerWeightUsd || 0),
        dto.qty,
        dto.unit_cost_usd,
      );
      const avgCostPerWeightBs = this.calculateWeightedAverage(
        currentStock,
        Number(currentCostPerWeightBs || 0),
        dto.qty,
        dto.unit_cost_bs,
      );

      const normalizedPerWeightUsd = this.roundToDecimals(
        avgCostPerWeightUsd,
        6,
      );
      const normalizedPerWeightBs = this.roundToDecimals(
        avgCostPerWeightBs,
        6,
      );

      product.cost_per_weight_usd = normalizedPerWeightUsd;
      product.cost_per_weight_bs = normalizedPerWeightBs;
      product.cost_usd = this.roundToTwoDecimals(
        this.getBaseCostFromPerWeight(normalizedPerWeightUsd, weightUnit),
      );
      product.cost_bs = this.roundToTwoDecimals(
        this.getBaseCostFromPerWeight(normalizedPerWeightBs, weightUnit),
      );
    } else {
      const avgCostUsd = this.calculateWeightedAverage(
        currentStock,
        Number(product.cost_usd || 0),
        dto.qty,
        dto.unit_cost_usd,
      );
      const avgCostBs = this.calculateWeightedAverage(
        currentStock,
        Number(product.cost_bs || 0),
        dto.qty,
        dto.unit_cost_bs,
      );

      product.cost_usd = this.roundToTwoDecimals(avgCostUsd);
      product.cost_bs = this.roundToTwoDecimals(avgCostBs);
    }
    await this.productRepository.save(product);

    // Crear movimiento de inventario
    const movement = this.movementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      product_id: dto.product_id,
      movement_type: 'received',
      qty_delta: dto.qty,
      unit_cost_bs: unitCostBs,
      unit_cost_usd: unitCostUsd,
      warehouse_id: warehouseId,
      note: dto.note || null,
      ref: dto.ref || null,
      happened_at: new Date(),
      approved: role === 'owner',
      requested_by: role === 'owner' ? null : userId,
      approved_by: role === 'owner' ? userId : null,
      approved_at: role === 'owner' ? new Date() : null,
    });

    const savedMovement = await this.movementRepository.save(movement);

    // Actualizar stock de la bodega si se especificó
    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        dto.product_id,
        null, // variant_id se puede obtener del ref si es necesario
        dto.qty,
        storeId,
      );
    }

    return savedMovement;
  }

  async stockAdjusted(
    storeId: string,
    dto: StockAdjustedDto,
    userId: string,
  ): Promise<InventoryMovement> {
    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Determinar bodega
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

    // Verificar que no se ajuste a negativo en la bodega específica
    if (dto.qty_delta < 0 && warehouseId) {
      const warehouseStock = await this.warehousesService.getStock(
        storeId,
        warehouseId,
        dto.product_id,
      );
      const currentStock = warehouseStock.reduce((sum, s) => sum + s.stock, 0);
      if (currentStock + dto.qty_delta < 0) {
        throw new BadRequestException(
          'No se puede ajustar el stock a negativo en esta bodega',
        );
      }
    }

    // Verificar que no se ajuste a negativo globalmente (si no hay bodega específica)
    if (dto.qty_delta < 0 && !warehouseId) {
      const currentStock = await this.getCurrentStock(storeId, dto.product_id);
      if (currentStock + dto.qty_delta < 0) {
        throw new BadRequestException(
          'No se puede ajustar el stock a negativo',
        );
      }
    }

    const movement = this.movementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      product_id: dto.product_id,
      movement_type: 'adjust',
      qty_delta: dto.qty_delta,
      unit_cost_bs: 0, // Los ajustes no tienen costo
      unit_cost_usd: 0,
      warehouse_id: warehouseId,
      note: dto.note || null,
      ref: { reason: dto.reason },
      happened_at: new Date(),
      approved: true,
      requested_by: userId,
      approved_by: userId,
      approved_at: new Date(),
    });

    const savedMovement = await this.movementRepository.save(movement);

    // Actualizar stock de la bodega si se especificó
    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        dto.product_id,
        null,
        dto.qty_delta,
        storeId,
      );
    }

    // Generar asiento contable automático (después de guardar el movimiento)
    setImmediate(async () => {
      try {
        // Recargar el movimiento con relaciones si es necesario
        const movementWithRelations = await this.movementRepository.findOne({
          where: { id: savedMovement.id },
          relations: ['product'],
        });
        if (movementWithRelations) {
          await this.accountingService.generateEntryFromInventoryAdjustment(storeId, movementWithRelations);
        }
      } catch (error) {
        // Log error pero no fallar el ajuste de inventario
        this.logger.error(
          `Error generando asiento contable para ajuste ${savedMovement.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    return savedMovement;
  }

  async getCurrentStock(storeId: string, productId: string): Promise<number> {
    const stockSubquery = this.buildWarehouseStockSubquery(storeId);
    const result = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin(
        `(${stockSubquery.getQuery()})`,
        'stock',
        'stock.product_id = product.id',
      )
      .setParameters(stockSubquery.getParameters())
      .select('COALESCE(stock.current_stock, 0)', 'current_stock')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.id = :productId', { productId })
      .getRawOne();

    return parseFloat(result?.current_stock) || 0;
  }

  async getStockStatus(
    storeId: string,
    queryDto: GetStockStatusDto = {},
  ): Promise<{ items: any[]; total: number }> {
    const {
      product_id: productId,
      warehouse_id: warehouseId,
      search,
      limit,
      offset,
      low_stock_only,
    } = queryDto;
    const normalizedSearch = search?.trim();
    const isPaginated = limit !== undefined || offset !== undefined;

    const stockSubquery = this.buildWarehouseStockSubquery(
      storeId,
      warehouseId,
    );

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin(
        `(${stockSubquery.getQuery()})`,
        'stock',
        'stock.product_id = product.id',
      )
      .setParameters(stockSubquery.getParameters())
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('product.low_stock_threshold', 'low_stock_threshold')
      .addSelect('COALESCE(stock.current_stock, 0)', 'current_stock')
      .addSelect('product.is_weight_product', 'is_weight_product')
      .addSelect('product.weight_unit', 'weight_unit')
      .addSelect('product.cost_per_weight_bs', 'cost_per_weight_bs')
      .addSelect('product.cost_per_weight_usd', 'cost_per_weight_usd')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.is_active = true');

    if (productId) {
      query.andWhere('product.id = :productId', { productId });
    }

    if (normalizedSearch) {
      query.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${normalizedSearch}%` },
      );
    }

    if (low_stock_only) {
      query.andWhere(
        'COALESCE(stock.current_stock, 0) <= product.low_stock_threshold',
      );
    }

    query.orderBy('product.name', 'ASC');

    let total = 0;
    if (isPaginated) {
      const countQuery = this.productRepository
        .createQueryBuilder('product')
        .leftJoin(
          `(${stockSubquery.getQuery()})`,
          'stock',
          'stock.product_id = product.id',
        )
        .setParameters(stockSubquery.getParameters())
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true');

      if (productId) {
        countQuery.andWhere('product.id = :productId', { productId });
      }

      if (normalizedSearch) {
        countQuery.andWhere(
          '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
          { search: `%${normalizedSearch}%` },
        );
      }

      if (low_stock_only) {
        countQuery.andWhere(
          'COALESCE(stock.current_stock, 0) <= product.low_stock_threshold',
        );
      }

      total = await countQuery.getCount();
    }

    if (limit !== undefined) {
      query.limit(limit);
    }
    if (offset !== undefined) {
      query.offset(offset);
    }

    const results = await query.getRawMany();

    const items = results.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      current_stock: parseFloat(row.current_stock) || 0,
      low_stock_threshold: row.low_stock_threshold,
      is_low_stock:
        (parseFloat(row.current_stock) || 0) <= row.low_stock_threshold,
      is_weight_product: row.is_weight_product || false,
      weight_unit: row.weight_unit || null,
      cost_per_weight_bs: row.cost_per_weight_bs ?? null,
      cost_per_weight_usd: row.cost_per_weight_usd ?? null,
    }));

    if (!isPaginated) {
      total = items.length;
    }

    return { items, total };
  }

  async getLowStockProducts(storeId: string): Promise<any[]> {
    const { items } = await this.getStockStatus(storeId, {
      low_stock_only: true,
    });
    return items;
  }

  async getMovements(
    storeId: string,
    productId?: string,
    limit: number = 50,
    offset: number = 0,
    includePending: boolean = true,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ movements: any[]; total: number }> {
    const query = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.store_id = :storeId', { storeId })
      .orderBy('movement.happened_at', 'DESC');

    if (productId) {
      query.andWhere('movement.product_id = :productId', { productId });
    }

    if (!includePending) {
      query.andWhere('movement.approved = true');
    }

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('movement.happened_at >= :startDate', { startDate: start });
    }

    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('movement.happened_at <= :endDate', { endDate: end });
    }

    const total = await query.getCount();

    query.limit(limit).offset(offset);

    const movements = await query.getMany();

    // Mapear para incluir nombre del producto
    return {
      movements: movements.map((movement) => ({
        ...movement,
        product_name: movement.product?.name || null,
      })),
      total,
    };
  }

  async approveReceivedMovement(
    storeId: string,
    movementId: string,
    approverId: string,
    role: string,
  ) {
    if (role !== 'owner') {
      throw new ForbiddenException(
        'Solo un owner puede aprobar entradas de stock',
      );
    }

    const movement = await this.movementRepository.findOne({
      where: { id: movementId, store_id: storeId, movement_type: 'received' },
    });

    if (!movement) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    if (movement.approved) {
      return movement;
    }

    movement.approved = true;
    movement.approved_by = approverId;
    movement.approved_at = new Date();

    return this.movementRepository.save(movement);
  }

  /**
   * Vaciar el stock de un producto específico (poner a 0)
   * Solo owners pueden ejecutar esta acción
   */
  async resetProductStock(
    storeId: string,
    productId: string,
    userId: string,
    role: string,
    note?: string,
  ): Promise<InventoryMovement | null> {
    if (role !== 'owner') {
      throw new ForbiddenException('Solo un owner puede vaciar el stock');
    }

    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Obtener stock actual
    const currentStock = await this.getCurrentStock(storeId, productId);

    // Si ya está en 0, no hacer nada
    if (currentStock === 0) {
      return null;
    }

    // Determinar bodega por defecto
    let warehouseId: string | null = null;
    const defaultWarehouse =
      await this.warehousesService.getDefaultOrFirst(storeId);
    warehouseId = defaultWarehouse.id;

    // Crear movimiento de ajuste para llevar a 0
    const movement = this.movementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      product_id: productId,
      movement_type: 'adjust',
      qty_delta: -currentStock, // Restar todo el stock actual
      unit_cost_bs: 0,
      unit_cost_usd: 0,
      warehouse_id: warehouseId,
      note: note || 'Stock vaciado manualmente por owner',
      ref: { reason: 'reset', previous_stock: currentStock },
      happened_at: new Date(),
      approved: true,
      requested_by: userId,
      approved_by: userId,
      approved_at: new Date(),
    });

    const savedMovement = await this.movementRepository.save(movement);

    // Actualizar stock de la bodega si se especificó
    if (warehouseId) {
      await this.warehousesService.updateStock(
        warehouseId,
        productId,
        null,
        -currentStock,
        storeId,
      );
    }

    return savedMovement;
  }

  /**
   * Vaciar TODO el inventario de la tienda (poner a 0)
   * Solo owners pueden ejecutar esta acción - PELIGROSO
   */
  async resetAllStock(
    storeId: string,
    userId: string,
    role: string,
    note?: string,
  ): Promise<{ reset_count: number; movements: InventoryMovement[] }> {
    if (role !== 'owner') {
      throw new ForbiddenException('Solo un owner puede vaciar todo el inventario');
    }

    // Obtener todos los productos con stock > 0
    const { items } = await this.getStockStatus(storeId, {});
    const productsWithStock = items.filter((item) => item.current_stock > 0);

    if (productsWithStock.length === 0) {
      return { reset_count: 0, movements: [] };
    }

    // Determinar bodega por defecto
    let warehouseId: string | null = null;
    const defaultWarehouse =
      await this.warehousesService.getDefaultOrFirst(storeId);
    warehouseId = defaultWarehouse.id;

    const movements: InventoryMovement[] = [];

    // Crear movimiento de ajuste para cada producto
    for (const product of productsWithStock) {
      const movement = this.movementRepository.create({
        id: randomUUID(),
        store_id: storeId,
        product_id: product.product_id,
        movement_type: 'adjust',
        qty_delta: -product.current_stock,
        unit_cost_bs: 0,
        unit_cost_usd: 0,
        warehouse_id: warehouseId,
        note: note || 'Stock vaciado en reset masivo por owner',
        ref: { reason: 'reset_all', previous_stock: product.current_stock },
        happened_at: new Date(),
        approved: true,
        requested_by: userId,
        approved_by: userId,
        approved_at: new Date(),
      });

      const savedMovement = await this.movementRepository.save(movement);
      movements.push(savedMovement);

      // Actualizar stock de la bodega
      if (warehouseId) {
        await this.warehousesService.updateStock(
          warehouseId,
          product.product_id,
          null,
          -product.current_stock,
          storeId,
        );
      }
    }

    return { reset_count: movements.length, movements };
  }
}
