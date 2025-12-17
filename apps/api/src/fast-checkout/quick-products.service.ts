import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickProduct } from '../database/entities/quick-product.entity';
import { Product } from '../database/entities/product.entity';
import { CreateQuickProductDto } from './dto/create-quick-product.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de productos rápidos
 */
@Injectable()
export class QuickProductsService {
  constructor(
    @InjectRepository(QuickProduct)
    private quickProductRepository: Repository<QuickProduct>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Crea o actualiza un producto rápido
   */
  async upsertQuickProduct(
    storeId: string,
    dto: CreateQuickProductDto,
  ): Promise<QuickProduct> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar si ya existe un producto rápido con esta tecla
    const existingByKey = await this.quickProductRepository.findOne({
      where: { store_id: storeId, quick_key: dto.quick_key },
    });

    if (existingByKey && existingByKey.product_id !== dto.product_id) {
      throw new BadRequestException(
        `La tecla rápida "${dto.quick_key}" ya está asignada a otro producto`,
      );
    }

    // Verificar si este producto ya tiene una tecla rápida
    const existingByProduct = await this.quickProductRepository.findOne({
      where: { store_id: storeId, product_id: dto.product_id },
    });

    if (existingByProduct && existingByProduct.quick_key !== dto.quick_key) {
      throw new BadRequestException(
        `Este producto ya tiene asignada la tecla rápida "${existingByProduct.quick_key}"`,
      );
    }

    // Si existe uno u otro, actualizar
    if (existingByKey) {
      existingByKey.quick_key = dto.quick_key;
      existingByKey.position = dto.position ?? existingByKey.position;
      existingByKey.is_active = dto.is_active ?? existingByKey.is_active;
      existingByKey.updated_at = new Date();

      return this.quickProductRepository.save(existingByKey);
    }

    if (existingByProduct) {
      existingByProduct.quick_key = dto.quick_key;
      existingByProduct.position = dto.position ?? existingByProduct.position;
      existingByProduct.is_active =
        dto.is_active ?? existingByProduct.is_active;
      existingByProduct.updated_at = new Date();

      return this.quickProductRepository.save(existingByProduct);
    }

    // Si no existe ninguno, crear nuevo
    {
      // Crear nuevo
      const quickProduct = this.quickProductRepository.create({
        id: randomUUID(),
        store_id: storeId,
        product_id: dto.product_id,
        quick_key: dto.quick_key,
        position: dto.position ?? 0,
        is_active: dto.is_active ?? true,
      });

      return this.quickProductRepository.save(quickProduct);
    }
  }

  /**
   * Obtiene todos los productos rápidos de una tienda
   */
  async getQuickProducts(storeId: string): Promise<QuickProduct[]> {
    return this.quickProductRepository.find({
      where: { store_id: storeId, is_active: true },
      relations: ['product'],
      order: { position: 'ASC', created_at: 'ASC' },
    });
  }

  /**
   * Obtiene un producto rápido por su tecla
   */
  async getQuickProductByKey(
    storeId: string,
    quickKey: string,
  ): Promise<QuickProduct | null> {
    return this.quickProductRepository.findOne({
      where: { store_id: storeId, quick_key: quickKey, is_active: true },
      relations: ['product'],
    });
  }

  /**
   * Elimina un producto rápido
   */
  async deleteQuickProduct(
    storeId: string,
    quickProductId: string,
  ): Promise<void> {
    const quickProduct = await this.quickProductRepository.findOne({
      where: { id: quickProductId, store_id: storeId },
    });

    if (!quickProduct) {
      throw new NotFoundException('Producto rápido no encontrado');
    }

    await this.quickProductRepository.remove(quickProduct);
  }

  /**
   * Desactiva un producto rápido
   */
  async deactivateQuickProduct(
    storeId: string,
    quickProductId: string,
  ): Promise<QuickProduct> {
    const quickProduct = await this.quickProductRepository.findOne({
      where: { id: quickProductId, store_id: storeId },
    });

    if (!quickProduct) {
      throw new NotFoundException('Producto rápido no encontrado');
    }

    quickProduct.is_active = false;
    quickProduct.updated_at = new Date();

    return this.quickProductRepository.save(quickProduct);
  }

  /**
   * Reordena productos rápidos
   */
  async reorderQuickProducts(
    storeId: string,
    quickProductIds: string[],
  ): Promise<QuickProduct[]> {
    const quickProducts = await this.quickProductRepository.find({
      where: { store_id: storeId },
    });

    // Actualizar posiciones
    for (let i = 0; i < quickProductIds.length; i++) {
      const quickProduct = quickProducts.find(
        (qp) => qp.id === quickProductIds[i],
      );
      if (quickProduct) {
        quickProduct.position = i;
        quickProduct.updated_at = new Date();
      }
    }

    return this.quickProductRepository.save(quickProducts);
  }
}
