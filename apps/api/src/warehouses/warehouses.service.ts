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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { randomUUID } from 'crypto';

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
    private dataSource: DataSource,
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
  ): Promise<WarehouseStock[]> {
    await this.findOne(storeId, warehouseId); // Validar que existe

    const where: any = { warehouse_id: warehouseId };
    if (productId) {
      where.product_id = productId;
    }

    return this.warehouseStockRepository.find({ where });
  }

  /**
   * Busca un registro de stock usando raw query para evitar bug de TypeORM
   */
  private async findStockRecord(
    warehouseId: string,
    productId: string,
    variantId: string | null,
  ): Promise<WarehouseStock | null> {
    const result = await this.dataSource.query(
      `SELECT id, warehouse_id, product_id, variant_id, stock, reserved, updated_at
       FROM warehouse_stock
       WHERE warehouse_id = $1
         AND product_id = $2
         AND (($3::uuid IS NULL AND variant_id IS NULL) OR variant_id = $3::uuid)
       LIMIT 1`,
      [warehouseId, productId, variantId],
    );
    return result[0] || null;
  }

  /**
   * Actualiza el stock de una bodega (usado internamente)
   */
  async updateStock(
    warehouseId: string,
    productId: string,
    variantId: string | null,
    qtyDelta: number,
  ): Promise<WarehouseStock> {
    const stock = await this.findStockRecord(warehouseId, productId, variantId);

    if (stock) {
      const newStockValue = Math.max(0, stock.stock + qtyDelta);
      await this.dataSource.query(
        `UPDATE warehouse_stock SET stock = $1, updated_at = NOW() WHERE id = $2`,
        [newStockValue, stock.id],
      );
      stock.stock = newStockValue;
      return stock;
    } else {
      const newId = randomUUID();
      const newStockValue = Math.max(0, qtyDelta);
      await this.dataSource.query(
        `INSERT INTO warehouse_stock (id, warehouse_id, product_id, variant_id, stock, reserved, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, NOW())`,
        [newId, warehouseId, productId, variantId, newStockValue],
      );
      return {
        id: newId,
        warehouse_id: warehouseId,
        product_id: productId,
        variant_id: variantId,
        stock: newStockValue,
        reserved: 0,
        updated_at: new Date(),
      } as WarehouseStock;
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
  ): Promise<void> {
    const stock = await this.findStockRecord(warehouseId, productId, variantId);

    if (!stock || stock.stock < quantity) {
      throw new BadRequestException('Stock insuficiente para reservar');
    }

    await this.dataSource.query(
      `UPDATE warehouse_stock SET stock = stock - $1, reserved = reserved + $1, updated_at = NOW() WHERE id = $2`,
      [quantity, stock.id],
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
      `UPDATE warehouse_stock SET stock = stock + $1, reserved = reserved - $1, updated_at = NOW() WHERE id = $2`,
      [quantity, stock.id],
    );
  }
}
