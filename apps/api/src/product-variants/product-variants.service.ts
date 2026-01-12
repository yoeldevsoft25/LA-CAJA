import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant } from '../database/entities/product-variant.entity';
import { Product } from '../database/entities/product.entity';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { randomUUID } from 'crypto';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';

/**
 * Servicio para gestión de variantes de productos
 */
@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private variantRepository: Repository<ProductVariant>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
  ) {}

  /**
   * Crea una nueva variante de producto
   */
  async createVariant(
    storeId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no existe una variante con el mismo tipo y valor
    const existing = await this.variantRepository.findOne({
      where: {
        product_id: dto.product_id,
        variant_type: dto.variant_type,
        variant_value: dto.variant_value,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una variante con tipo "${dto.variant_type}" y valor "${dto.variant_value}" para este producto`,
      );
    }

    const variant = this.variantRepository.create({
      id: randomUUID(),
      product_id: dto.product_id,
      variant_type: dto.variant_type,
      variant_value: dto.variant_value,
      sku: dto.sku || null,
      barcode: dto.barcode || null,
      price_bs: dto.price_bs ?? null,
      price_usd: dto.price_usd ?? null,
      is_active: dto.is_active ?? true,
    });

    return this.variantRepository.save(variant);
  }

  /**
   * Actualiza una variante existente
   */
  async updateVariant(
    storeId: string,
    variantId: string,
    dto: Partial<CreateProductVariantDto>,
  ): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
      relations: ['product'],
    });

    if (!variant) {
      throw new NotFoundException('Variante no encontrada');
    }

    // Verificar que el producto pertenece a la tienda
    if (variant.product.store_id !== storeId) {
      throw new NotFoundException('Variante no encontrada');
    }

    // Si se actualiza tipo o valor, verificar que no exista otra variante igual
    if (dto.variant_type || dto.variant_value) {
      const newType = dto.variant_type ?? variant.variant_type;
      const newValue = dto.variant_value ?? variant.variant_value;

      if (
        newType !== variant.variant_type ||
        newValue !== variant.variant_value
      ) {
        const existing = await this.variantRepository.findOne({
          where: {
            product_id: variant.product_id,
            variant_type: newType,
            variant_value: newValue,
          },
        });

        if (existing && existing.id !== variantId) {
          throw new BadRequestException(
            `Ya existe una variante con tipo "${newType}" y valor "${newValue}" para este producto`,
          );
        }
      }
    }

    // Actualizar campos
    if (dto.variant_type !== undefined) {
      variant.variant_type = dto.variant_type;
    }
    if (dto.variant_value !== undefined) {
      variant.variant_value = dto.variant_value;
    }
    if (dto.sku !== undefined) {
      variant.sku = dto.sku;
    }
    if (dto.barcode !== undefined) {
      variant.barcode = dto.barcode;
    }
    if (dto.price_bs !== undefined) {
      variant.price_bs = dto.price_bs;
    }
    if (dto.price_usd !== undefined) {
      variant.price_usd = dto.price_usd;
    }
    if (dto.is_active !== undefined) {
      variant.is_active = dto.is_active;
    }

    variant.updated_at = new Date();

    return this.variantRepository.save(variant);
  }

  /**
   * Obtiene todas las variantes de un producto
   */
  async getVariantsByProduct(
    storeId: string,
    productId: string,
  ): Promise<ProductVariant[]> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.variantRepository.find({
      where: { product_id: productId, is_active: true },
      order: { variant_type: 'ASC', variant_value: 'ASC' },
    });
  }

  /**
   * Obtiene una variante por su ID
   */
  async getVariantById(
    storeId: string,
    variantId: string,
  ): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
      relations: ['product'],
    });

    if (!variant || variant.product.store_id !== storeId) {
      throw new NotFoundException('Variante no encontrada');
    }

    return variant;
  }

  /**
   * Obtiene una variante por código de barras
   */
  async getVariantByBarcode(
    storeId: string,
    barcode: string,
  ): Promise<ProductVariant | null> {
    return this.variantRepository
      .createQueryBuilder('variant')
      .innerJoin('variant.product', 'product')
      .where('variant.barcode = :barcode', { barcode })
      .andWhere('product.store_id = :storeId', { storeId })
      .andWhere('variant.is_active = true')
      .getOne();
  }

  /**
   * Obtiene el stock actual de una variante
   */
  async getVariantStock(storeId: string, variantId: string): Promise<number> {
    const variant = await this.getVariantById(storeId, variantId);

    // Calcular stock sumando todos los movimientos aprobados usando query builder
    const result = await this.movementRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere('movement.product_id = :productId', {
        productId: variant.product_id,
      })
      .andWhere('movement.variant_id = :variantId', { variantId })
      .andWhere('movement.approved = true')
      .getRawOne();

    return parseFloat(result.stock) || 0;
  }

  /**
   * Elimina una variante (soft delete)
   */
  async deleteVariant(storeId: string, variantId: string): Promise<void> {
    const variant = await this.getVariantById(storeId, variantId);

    // Verificar que no tenga stock
    const stock = await this.getVariantStock(storeId, variantId);
    if (stock > 0) {
      throw new BadRequestException(
        `No se puede eliminar la variante. Tiene ${stock} unidades en stock.`,
      );
    }

    // Soft delete: desactivar
    variant.is_active = false;
    variant.updated_at = new Date();
    await this.variantRepository.save(variant);
  }

  /**
   * Obtiene todas las variantes agrupadas por tipo
   */
  async getVariantsGroupedByType(
    storeId: string,
    productId: string,
  ): Promise<Record<string, ProductVariant[]>> {
    const variants = await this.getVariantsByProduct(storeId, productId);

    return variants.reduce(
      (acc, variant) => {
        if (!acc[variant.variant_type]) {
          acc[variant.variant_type] = [];
        }
        acc[variant.variant_type].push(variant);
        return acc;
      },
      {} as Record<string, ProductVariant[]>,
    );
  }
}
