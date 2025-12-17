import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Product } from '../database/entities/product.entity';
import { StockReceivedDto } from './dto/stock-received.dto';
import { StockAdjustedDto } from './dto/stock-adjusted.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private warehousesService: WarehousesService,
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
      const defaultWarehouse = await this.warehousesService.getDefault(storeId);
      if (defaultWarehouse) {
        warehouseId = defaultWarehouse.id;
      }
    }

    // Crear movimiento de inventario
    const movement = this.movementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      product_id: dto.product_id,
      movement_type: 'received',
      qty_delta: dto.qty,
      unit_cost_bs: dto.unit_cost_bs,
      unit_cost_usd: dto.unit_cost_usd,
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
      const defaultWarehouse = await this.warehousesService.getDefault(storeId);
      if (defaultWarehouse) {
        warehouseId = defaultWarehouse.id;
      }
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
      );
    }

    return savedMovement;
  }

  async getCurrentStock(storeId: string, productId: string): Promise<number> {
    const result = await this.movementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', { productId })
      .andWhere('movement.approved = true')
      .getRawOne();

    return parseInt(result.stock, 10) || 0;
  }

  async getStockStatus(storeId: string, productId?: string): Promise<any[]> {
    let query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin(
        'inventory_movements',
        'movement',
        'movement.product_id = product.id AND movement.store_id = :storeId AND movement.approved = true',
        { storeId },
      )
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('product.low_stock_threshold', 'low_stock_threshold')
      .addSelect('COALESCE(SUM(movement.qty_delta), 0)', 'current_stock')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.is_active = true')
      .groupBy('product.id, product.name, product.low_stock_threshold');

    if (productId) {
      query = query.andWhere('product.id = :productId', { productId });
    }

    const results = await query.getRawMany();

    return results.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      current_stock: parseInt(row.current_stock, 10) || 0,
      low_stock_threshold: row.low_stock_threshold,
      is_low_stock: parseInt(row.current_stock, 10) <= row.low_stock_threshold,
    }));
  }

  async getLowStockProducts(storeId: string): Promise<any[]> {
    const allStock = await this.getStockStatus(storeId);
    return allStock.filter((item) => item.is_low_stock);
  }

  async getMovements(
    storeId: string,
    productId?: string,
    limit: number = 50,
    offset: number = 0,
    includePending: boolean = true,
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
}
