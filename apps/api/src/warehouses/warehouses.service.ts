import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Warehouse } from '../database/entities/warehouse.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { Product } from '../database/entities/product.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationSeverity,
  NotificationType,
} from '../notifications/dto/create-notification.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { randomUUID } from 'crypto';

export interface WarehouseStockSummary {
  id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  stock: number;
  reserved: number;
  updated_at: Date;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
  } | null;
  variant: {
    id: string;
    variant_type: string;
    variant_value: string;
  } | null;
}

/**
 * Servicio para gestión de bodegas/almacenes
 */
@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseStock)
    private warehouseStockRepository: Repository<WarehouseStock>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Crea una nueva bodega
   */
  async create(storeId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    // Validar que el código no exista
    const existing = await this.warehouseRepository.findOne({
      where: { store_id: storeId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una bodega con el código "${dto.code}"`,
      );
    }

    // Si se marca como default, desmarcar otras
    if (dto.is_default) {
      await this.warehouseRepository.update(
        { store_id: storeId, is_default: true },
        { is_default: false },
      );
    }

    const warehouse = this.warehouseRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      code: dto.code,
      description: dto.description || null,
      address: dto.address || null,
      is_default: dto.is_default || false,
      is_active: true,
      note: dto.note || null,
    });

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * Obtiene todas las bodegas de una tienda
   */
  async findAll(
    storeId: string,
    includeInactive: boolean = false,
  ): Promise<Warehouse[]> {
    const where: any = { store_id: storeId };
    if (!includeInactive) {
      where.is_active = true;
    }

    return this.warehouseRepository.find({
      where,
      order: { is_default: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Obtiene una bodega por ID
   */
  async findOne(storeId: string, warehouseId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId, store_id: storeId },
    });

    if (!warehouse) {
      throw new NotFoundException('Bodega no encontrada');
    }

    return warehouse;
  }

  /**
   * Obtiene la bodega por defecto de una tienda
   */
  async getDefault(storeId: string): Promise<Warehouse | null> {
    return this.warehouseRepository.findOne({
      where: { store_id: storeId, is_default: true, is_active: true },
    });
  }

  async getDefaultOrFirst(storeId: string): Promise<Warehouse> {
    const defaultWarehouse = await this.getDefault(storeId);
    if (defaultWarehouse) {
      return defaultWarehouse;
    }

    const fallback = await this.warehouseRepository.findOne({
      where: { store_id: storeId, is_active: true },
      order: { is_default: 'DESC', name: 'ASC' },
    });

    if (!fallback) {
      throw new BadRequestException(
        'No hay bodegas configuradas. Debes crear al menos una bodega activa.',
      );
    }

    this.logger.warn(
      `Tienda ${storeId} sin bodega por defecto. Usando ${fallback.id} como fallback temporal.`,
    );
    return fallback;
  }

  /**
   * Actualiza una bodega
   */
  async update(
    storeId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(storeId, warehouseId);

    // Si se cambia el código, validar que no exista
    if (dto.code && dto.code !== warehouse.code) {
      const existing = await this.warehouseRepository.findOne({
        where: { store_id: storeId, code: dto.code },
      });

      if (existing) {
        throw new BadRequestException(
          `Ya existe una bodega con el código "${dto.code}"`,
        );
      }
    }

    // Si se marca como default, desmarcar otras
    if (dto.is_default === true && !warehouse.is_default) {
      await this.warehouseRepository.update(
        { store_id: storeId, is_default: true },
        { is_default: false },
      );
    }

    // Actualizar campos
    if (dto.name !== undefined) warehouse.name = dto.name;
    if (dto.code !== undefined) warehouse.code = dto.code;
    if (dto.description !== undefined) warehouse.description = dto.description;
    if (dto.address !== undefined) warehouse.address = dto.address;
    if (dto.is_default !== undefined) warehouse.is_default = dto.is_default;
    if (dto.is_active !== undefined) warehouse.is_active = dto.is_active;
    if (dto.note !== undefined) warehouse.note = dto.note;

    return this.warehouseRepository.save(warehouse);
  }

  /**
   * Elimina una bodega (soft delete: desactiva)
   */
  async remove(storeId: string, warehouseId: string): Promise<void> {
    const warehouse = await this.findOne(storeId, warehouseId);

    // Verificar que no sea la bodega por defecto
    if (warehouse.is_default) {
      throw new BadRequestException(
        'No se puede eliminar la bodega por defecto',
      );
    }

    // Verificar que no tenga stock
    const stock = await this.warehouseStockRepository
      .createQueryBuilder('stock')
      .where('stock.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('stock.stock > 0')
      .getCount();

    if (stock > 0) {
      throw new BadRequestException(
        'No se puede eliminar una bodega con stock disponible',
      );
    }

    // Desactivar en lugar de eliminar
    warehouse.is_active = false;
    await this.warehouseRepository.save(warehouse);
  }

  /**
   * Obtiene el stock de una bodega
   */
  async getStock(
    storeId: string,
    warehouseId: string,
    productId?: string,
  ): Promise<WarehouseStockSummary[]> {
    await this.findOne(storeId, warehouseId); // Validar que existe

    const query = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.product', 'product')
      .leftJoinAndSelect('stock.variant', 'variant')
      .where('stock.warehouse_id = :warehouseId', { warehouseId });

    if (productId) {
      query.andWhere('stock.product_id = :productId', { productId });
    }

    const stocks = await query.getMany();

    return Promise.all(
      stocks.map(async (stock) => {
        const product = stock.product ? await stock.product : null;
        const variant = stock.variant ? await stock.variant : null;

        return {
          id: stock.id,
          warehouse_id: stock.warehouse_id,
          product_id: stock.product_id,
          variant_id: stock.variant_id,
          stock: Number(stock.stock) || 0,
          reserved: Number(stock.reserved) || 0,
          updated_at: stock.updated_at,
          product: product
            ? {
                id: product.id,
                name: product.name,
                sku: product.sku ?? null,
                barcode: product.barcode ?? null,
              }
            : null,
          variant: variant
            ? {
                id: variant.id,
                variant_type: variant.variant_type,
                variant_value: variant.variant_value,
              }
            : null,
        };
      }),
    );
  }

  async getStockQuantity(
    storeId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
  ): Promise<number> {
    await this.findOne(storeId, warehouseId);

    const stock = await this.findStockRecord(warehouseId, productId, variantId);
    return stock ? Number(stock.stock) || 0 : 0;
  }

  async getTotalStockQuantity(
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<number> {
    const query = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .select('COALESCE(SUM(stock.stock), 0)', 'total')
      .innerJoin('stock.warehouse', 'warehouse')
      .where('warehouse.store_id = :storeId', { storeId })
      .andWhere('stock.product_id = :productId', { productId });

    if (variantId) {
      query.andWhere('stock.variant_id = :variantId', { variantId });
    } else {
      query.andWhere('stock.variant_id IS NULL');
    }

    const result = await query.getRawOne();
    return Number(result?.total) || 0;
  }

  /**
   * Busca un registro de stock usando raw query para evitar bug de TypeORM
   * Maneja el caso donde la tabla puede o no tener la columna id
   */
  private async findStockRecord(
    warehouseId: string,
    productId: string,
    variantId: string | null,
  ): Promise<WarehouseStock | null> {
    // Intentar obtener con id primero (si existe)
    try {
      const result = await this.dataSource.query(
        `SELECT id, warehouse_id, product_id, variant_id, stock, reserved, updated_at
         FROM warehouse_stock
         WHERE warehouse_id = $1
           AND product_id = $2
           AND (($3::uuid IS NULL AND variant_id IS NULL) OR variant_id = $3::uuid)
         LIMIT 1`,
        [warehouseId, productId, variantId],
      );
      if (!result[0]) {
        return null;
      }
      return {
        ...result[0],
        stock: Number(result[0].stock),
        reserved: Number(result[0].reserved),
      } as WarehouseStock;
    } catch (error: any) {
      // Si falla porque no existe la columna id, intentar sin ella
      if (error.message?.includes('column "id"') || error.message?.includes('does not exist')) {
        const result = await this.dataSource.query(
          `SELECT warehouse_id, product_id, variant_id, stock, reserved, updated_at
           FROM warehouse_stock
           WHERE warehouse_id = $1
             AND product_id = $2
             AND (($3::uuid IS NULL AND variant_id IS NULL) OR variant_id = $3::uuid)
           LIMIT 1`,
          [warehouseId, productId, variantId],
        );
        if (!result[0]) {
          return null;
        }
        // Generar un id temporal para compatibilidad con la entidad TypeORM
        const record = result[0];
        return {
          id: `${record.warehouse_id}-${record.product_id}-${record.variant_id || 'null'}`,
          ...record,
          stock: Number(record.stock),
          reserved: Number(record.reserved),
        } as WarehouseStock;
      }
      throw error;
    }
  }

  private async maybeNotifyLowStock(
    storeId: string | null,
    productId: string,
    previousStock: number,
    newStock: number,
  ): Promise<void> {
    if (!storeId) {
      return;
    }

    if (newStock >= previousStock) {
      return;
    }

    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId, is_active: true },
      select: ['id', 'name', 'low_stock_threshold'],
    });

    if (!product) {
      return;
    }

    const threshold = Number(product.low_stock_threshold || 0);
    if (threshold <= 0) {
      return;
    }

    if (previousStock > threshold && newStock <= threshold) {
      try {
        await this.notificationsService.createNotification(storeId, {
          notification_type: NotificationType.WARNING,
          category: 'inventory',
          title: `Stock bajo: ${product.name}`,
          message: `El stock de ${product.name} bajó a ${newStock} (umbral ${threshold}).`,
          priority: NotificationPriority.HIGH,
          severity: NotificationSeverity.MEDIUM,
          entity_type: 'product',
          entity_id: product.id,
          action_url: '/inventory',
          action_label: 'Ver inventario',
          metadata: {
            product_id: product.id,
            previous_stock: previousStock,
            current_stock: newStock,
            threshold,
          },
        });
      } catch (error) {
        this.logger.error(
          `No se pudo crear notificación de stock bajo para ${productId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Actualiza el stock de una bodega (usado internamente)
   */
  async updateStock(
    warehouseId: string,
    productId: string,
    variantId: string | null,
    qtyDelta: number,
    storeId?: string,
  ): Promise<WarehouseStock> {
    const stock = await this.findStockRecord(warehouseId, productId, variantId);
    const previousStock = stock ? Number(stock.stock) || 0 : 0;
    const resolvedStoreId =
      storeId ||
      (
        await this.warehouseRepository.findOne({
          where: { id: warehouseId },
          select: ['store_id'],
        })
      )?.store_id ||
      null;

    if (stock) {
      // ⚡ OPTIMIZACIÓN CRÍTICA: Usar UPDATE con cálculo atómico y RETURNING
      // Esto evita race conditions y es más eficiente que calcular fuera y luego actualizar
      const result = await this.dataSource.query(
        `UPDATE warehouse_stock 
         SET stock = GREATEST(0, stock + $1), updated_at = NOW() 
         WHERE warehouse_id = $2 
           AND product_id = $3 
           AND (($4::uuid IS NULL AND variant_id IS NULL) OR variant_id = $4::uuid)
         RETURNING stock`,
        [qtyDelta, warehouseId, productId, variantId],
      );

      let newStockValue: number;
      if (!result || result.length === 0) {
        // Stock fue eliminado entre findStockRecord y UPDATE, recrear
        newStockValue = Math.max(0, qtyDelta);
        const insertResult = await this.dataSource.query(
          `INSERT INTO warehouse_stock (id, warehouse_id, product_id, variant_id, stock, reserved, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, NOW())
           ON CONFLICT (warehouse_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
           DO UPDATE SET stock = GREATEST(0, warehouse_stock.stock + $5), updated_at = NOW()
           RETURNING stock`,
          [warehouseId, productId, variantId, newStockValue, qtyDelta],
        );
        newStockValue = insertResult && insertResult.length > 0 
          ? Number(insertResult[0].stock) 
          : newStockValue;
        stock.stock = newStockValue;
      } else {
        newStockValue = Number(result[0].stock);
        stock.stock = newStockValue;
      }
      
      await this.maybeNotifyLowStock(
        resolvedStoreId,
        productId,
        previousStock,
        newStockValue,
      );
      return stock;
    } else {
      const newStockValue = Math.max(0, qtyDelta);
      // Intentar insertar con id primero (si la tabla lo tiene)
      try {
        const newId = randomUUID();
        // PostgreSQL maneja NULL en UNIQUE correctamente, pero necesitamos
        // usar una expresión que funcione tanto con NULL como con valores
        await this.dataSource.query(
          `INSERT INTO warehouse_stock (id, warehouse_id, product_id, variant_id, stock, reserved, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, NOW())
           ON CONFLICT (warehouse_id, product_id, variant_id) 
           DO UPDATE SET stock = warehouse_stock.stock + $5, updated_at = NOW()`,
          [newId, warehouseId, productId, variantId, newStockValue],
        );
        const created = {
          id: newId,
          warehouse_id: warehouseId,
          product_id: productId,
          variant_id: variantId,
          stock: newStockValue,
          reserved: 0,
          updated_at: new Date(),
        } as WarehouseStock;
        await this.maybeNotifyLowStock(
          resolvedStoreId,
          productId,
          previousStock,
          newStockValue,
        );
        return created;
      } catch (error: any) {
        // Si falla porque variant_id no puede ser NULL, la migración aún no se ejecutó
        if (error.message?.includes('null value in column "variant_id"')) {
          this.logger.error(
            'variant_id no permite NULL. Ejecuta la migración 25_fix_warehouse_stock_variant_null.sql',
          );
          throw new BadRequestException(
            'El sistema necesita actualización: variant_id debe permitir NULL. Contacta al administrador.',
          );
        }
        // Si falla porque no existe la columna id, intentar sin id
        if (error.message?.includes('column "id"') || error.message?.includes('does not exist')) {
          await this.dataSource.query(
            `INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock, reserved, updated_at)
             VALUES ($1, $2, $3, $4, 0, NOW())
             ON CONFLICT (warehouse_id, product_id, variant_id) 
             DO UPDATE SET stock = warehouse_stock.stock + $4, updated_at = NOW()`,
            [warehouseId, productId, variantId, newStockValue],
          );
          const created = {
            id: `${warehouseId}-${productId}-${variantId || 'null'}`,
            warehouse_id: warehouseId,
            product_id: productId,
            variant_id: variantId,
            stock: newStockValue,
            reserved: 0,
            updated_at: new Date(),
          } as WarehouseStock;
          await this.maybeNotifyLowStock(
            resolvedStoreId,
            productId,
            previousStock,
            newStockValue,
          );
          return created;
        }
        throw error;
      }
    }
  }

  /**
   * Reserva stock en una bodega (para transferencias pendientes)
   */
  async reserveStock(
    warehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    storeId?: string,
  ): Promise<void> {
    const stock = await this.findStockRecord(warehouseId, productId, variantId);

    if (!stock || stock.stock < quantity) {
      throw new BadRequestException('Stock insuficiente para reservar');
    }

    const previousStock = Number(stock.stock) || 0;
    await this.dataSource.query(
      `UPDATE warehouse_stock 
       SET stock = stock - $1, reserved = reserved + $1, updated_at = NOW() 
       WHERE warehouse_id = $2 
         AND product_id = $3 
         AND (($4::uuid IS NULL AND variant_id IS NULL) OR variant_id = $4::uuid)`,
      [quantity, warehouseId, productId, variantId],
    );
    const resolvedStoreId =
      storeId ||
      (
        await this.warehouseRepository.findOne({
          where: { id: warehouseId },
          select: ['store_id'],
        })
      )?.store_id ||
      null;
    const newStockValue = Math.max(0, previousStock - quantity);
    await this.maybeNotifyLowStock(
      resolvedStoreId,
      productId,
      previousStock,
      newStockValue,
    );
  }

  /**
   * Libera stock reservado
   */
  async releaseReservedStock(
    warehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    const stock = await this.findStockRecord(warehouseId, productId, variantId);

    if (!stock || stock.reserved < quantity) {
      throw new BadRequestException('Stock reservado insuficiente');
    }

    await this.dataSource.query(
      `UPDATE warehouse_stock 
       SET stock = stock + $1, reserved = reserved - $1, updated_at = NOW() 
       WHERE warehouse_id = $2 
         AND product_id = $3 
         AND (($4::uuid IS NULL AND variant_id IS NULL) OR variant_id = $4::uuid)`,
      [quantity, warehouseId, productId, variantId],
    );
  }
}
