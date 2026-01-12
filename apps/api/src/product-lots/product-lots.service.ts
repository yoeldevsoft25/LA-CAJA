import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductLot } from '../database/entities/product-lot.entity';
import { LotMovement } from '../database/entities/lot-movement.entity';
import { Product } from '../database/entities/product.entity';
import { CreateProductLotDto } from './dto/create-product-lot.dto';
import { CreateLotMovementDto } from './dto/create-lot-movement.dto';
import { randomUUID } from 'crypto';
import { InventoryRulesService } from './inventory-rules.service';

/**
 * Servicio para gestión de lotes de productos
 */
@Injectable()
export class ProductLotsService {
  constructor(
    @InjectRepository(ProductLot)
    private lotRepository: Repository<ProductLot>,
    @InjectRepository(LotMovement)
    private lotMovementRepository: Repository<LotMovement>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private inventoryRulesService: InventoryRulesService,
  ) {}

  /**
   * Crea un nuevo lote de producto
   */
  async createLot(
    storeId: string,
    dto: CreateProductLotDto,
  ): Promise<ProductLot> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no existe un lote con el mismo número
    const existing = await this.lotRepository.findOne({
      where: {
        product_id: dto.product_id,
        lot_number: dto.lot_number,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un lote con número "${dto.lot_number}" para este producto`,
      );
    }

    const receivedAt = new Date(dto.received_at);
    const expirationDate = dto.expiration_date
      ? new Date(dto.expiration_date)
      : null;

    return this.dataSource.transaction(async (manager) => {
      // Crear el lote
      const lot = manager.create(ProductLot, {
        id: randomUUID(),
        product_id: dto.product_id,
        lot_number: dto.lot_number,
        initial_quantity: dto.initial_quantity,
        remaining_quantity: dto.initial_quantity,
        unit_cost_bs: dto.unit_cost_bs,
        unit_cost_usd: dto.unit_cost_usd,
        expiration_date: expirationDate,
        received_at: receivedAt,
        supplier: dto.supplier || null,
        note: dto.note || null,
      });

      const savedLot = await manager.save(ProductLot, lot);

      // Crear movimiento inicial de recepción
      const movement = manager.create(LotMovement, {
        id: randomUUID(),
        lot_id: savedLot.id,
        movement_type: 'received',
        qty_delta: dto.initial_quantity,
        happened_at: receivedAt,
        note: `Recepción inicial del lote ${dto.lot_number}`,
      });

      await manager.save(LotMovement, movement);

      return savedLot;
    });
  }

  /**
   * Obtiene todos los lotes de un producto
   */
  async getLotsByProduct(
    storeId: string,
    productId: string,
  ): Promise<ProductLot[]> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.lotRepository.find({
      where: { product_id: productId },
      order: { received_at: 'ASC' },
      relations: ['movements'],
    });
  }

  /**
   * Obtiene un lote por su ID
   */
  async getLotById(storeId: string, lotId: string): Promise<ProductLot> {
    const lot = await this.lotRepository.findOne({
      where: { id: lotId },
      relations: ['product', 'movements'],
    });

    if (!lot || lot.product.store_id !== storeId) {
      throw new NotFoundException('Lote no encontrado');
    }

    return lot;
  }

  /**
   * Obtiene lotes próximos a vencer
   */
  async getLotsExpiringSoon(
    storeId: string,
    daysAhead: number = 30,
  ): Promise<ProductLot[]> {
    const lots = await this.lotRepository
      .createQueryBuilder('lot')
      .innerJoin('lot.product', 'product')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('lot.expiration_date IS NOT NULL')
      .andWhere('lot.remaining_quantity > 0')
      .getMany();

    return this.inventoryRulesService.getLotsExpiringSoon(lots, daysAhead);
  }

  /**
   * Obtiene lotes vencidos
   */
  async getExpiredLots(storeId: string): Promise<ProductLot[]> {
    const lots = await this.lotRepository
      .createQueryBuilder('lot')
      .innerJoin('lot.product', 'product')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('lot.expiration_date IS NOT NULL')
      .andWhere('lot.remaining_quantity > 0')
      .getMany();

    return this.inventoryRulesService.getExpiredLots(lots);
  }

  /**
   * Crea un movimiento de lote
   */
  async createLotMovement(
    storeId: string,
    dto: CreateLotMovementDto,
  ): Promise<LotMovement> {
    const lot = await this.getLotById(storeId, dto.lot_id);

    return this.dataSource.transaction(async (manager) => {
      // Crear el movimiento
      const movement = manager.create(LotMovement, {
        id: randomUUID(),
        lot_id: dto.lot_id,
        movement_type: dto.movement_type,
        qty_delta: dto.qty_delta,
        happened_at: new Date(dto.happened_at),
        sale_id: dto.sale_id || null,
        note: dto.note || null,
      });

      const savedMovement = await manager.save(LotMovement, movement);

      // Actualizar cantidad restante del lote
      lot.remaining_quantity =
        Number(lot.remaining_quantity) + Number(dto.qty_delta);

      if (lot.remaining_quantity < 0) {
        throw new BadRequestException(
          `La cantidad restante del lote no puede ser negativa. Actual: ${Number(lot.remaining_quantity) + Number(dto.qty_delta)}`,
        );
      }

      lot.updated_at = new Date();
      await manager.save(ProductLot, lot);

      return savedMovement;
    });
  }

  /**
   * Obtiene los movimientos de un lote
   */
  async getLotMovements(
    storeId: string,
    lotId: string,
  ): Promise<LotMovement[]> {
    await this.getLotById(storeId, lotId);

    return this.lotMovementRepository.find({
      where: { lot_id: lotId },
      order: { happened_at: 'DESC' },
      relations: ['sale'],
    });
  }
}
