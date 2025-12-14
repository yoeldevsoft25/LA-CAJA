import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement, MovementType } from '../database/entities/inventory-movement.entity';
import { Product } from '../database/entities/product.entity';
import { StockReceivedDto } from './dto/stock-received.dto';
import { StockAdjustedDto } from './dto/stock-adjusted.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async stockReceived(storeId: string, dto: StockReceivedDto): Promise<InventoryMovement> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const movement = this.movementRepository.create({
      id: randomUUID(),
      store_id: storeId,
      product_id: dto.product_id,
      movement_type: 'received',
      qty_delta: dto.qty,
      unit_cost_bs: dto.unit_cost_bs,
      unit_cost_usd: dto.unit_cost_usd,
      note: dto.note || null,
      ref: dto.ref || null,
      happened_at: new Date(),
    });

    return this.movementRepository.save(movement);
  }

  async stockAdjusted(storeId: string, dto: StockAdjustedDto): Promise<InventoryMovement> {
    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no se ajuste a negativo (opcional, puedes remover esta validación)
    if (dto.qty_delta < 0) {
      const currentStock = await this.getCurrentStock(storeId, dto.product_id);
      if (currentStock + dto.qty_delta < 0) {
        throw new BadRequestException('No se puede ajustar el stock a negativo');
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
      note: dto.note || null,
      ref: null,
      happened_at: new Date(),
    });

    return this.movementRepository.save(movement);
  }

  async getCurrentStock(storeId: string, productId: string): Promise<number> {
    const result = await this.movementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', { productId })
      .getRawOne();

    return parseInt(result.stock, 10) || 0;
  }

  async getStockStatus(storeId: string, productId?: string): Promise<any[]> {
    let query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin(
        'inventory_movements',
        'movement',
        'movement.product_id = product.id AND movement.store_id = :storeId',
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
  ): Promise<{ movements: any[]; total: number }> {
    const query = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.store_id = :storeId', { storeId })
      .orderBy('movement.happened_at', 'DESC');

    if (productId) {
      query.andWhere('movement.product_id = :productId', { productId });
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
}

