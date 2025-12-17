import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import {
  Promotion,
  PromotionType,
} from '../database/entities/promotion.entity';
import { PromotionProduct } from '../database/entities/promotion-product.entity';
import { PromotionUsage } from '../database/entities/promotion-usage.entity';
import { Product } from '../database/entities/product.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de promociones
 */
@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private promotionRepository: Repository<Promotion>,
    @InjectRepository(PromotionProduct)
    private promotionProductRepository: Repository<PromotionProduct>,
    @InjectRepository(PromotionUsage)
    private promotionUsageRepository: Repository<PromotionUsage>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  /**
   * Crea una nueva promoción
   */
  async createPromotion(
    storeId: string,
    dto: CreatePromotionDto,
  ): Promise<Promotion> {
    // Validar fechas
    const validFrom = new Date(dto.valid_from);
    const validUntil = new Date(dto.valid_until);

    if (validUntil <= validFrom) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    // Validar tipo de promoción
    if (dto.promotion_type === 'percentage' && !dto.discount_percentage) {
      throw new BadRequestException(
        'Las promociones de porcentaje requieren discount_percentage',
      );
    }

    if (
      dto.promotion_type === 'fixed_amount' &&
      !dto.discount_amount_bs &&
      !dto.discount_amount_usd
    ) {
      throw new BadRequestException(
        'Las promociones de monto fijo requieren discount_amount_bs o discount_amount_usd',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const promotion = manager.create(Promotion, {
        id: randomUUID(),
        store_id: storeId,
        name: dto.name,
        code: dto.code || null,
        description: dto.description || null,
        promotion_type: dto.promotion_type,
        discount_percentage: dto.discount_percentage || null,
        discount_amount_bs: dto.discount_amount_bs || null,
        discount_amount_usd: dto.discount_amount_usd || null,
        min_purchase_bs: dto.min_purchase_bs || null,
        min_purchase_usd: dto.min_purchase_usd || null,
        max_discount_bs: dto.max_discount_bs || null,
        max_discount_usd: dto.max_discount_usd || null,
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
        usage_limit: dto.usage_limit || null,
        usage_count: 0,
        customer_limit: dto.customer_limit || null,
        note: dto.note || null,
      });

      const savedPromotion = await manager.save(Promotion, promotion);

      // Agregar productos si se proporcionan
      if (dto.products && dto.products.length > 0) {
        for (const productDto of dto.products) {
          // Verificar que el producto existe
          const product = await manager.findOne(Product, {
            where: { id: productDto.product_id, store_id: storeId },
          });

          if (!product) {
            throw new NotFoundException(
              `Producto ${productDto.product_id} no encontrado`,
            );
          }

          const promotionProduct = manager.create(PromotionProduct, {
            id: randomUUID(),
            promotion_id: savedPromotion.id,
            product_id: productDto.product_id,
            variant_id: productDto.variant_id || null,
          });

          await manager.save(PromotionProduct, promotionProduct);
        }
      }

      return savedPromotion;
    });
  }

  /**
   * Obtiene todas las promociones activas de una tienda
   */
  async getActivePromotions(storeId: string): Promise<Promotion[]> {
    const now = new Date();

    return this.promotionRepository.find({
      where: {
        store_id: storeId,
        is_active: true,
        valid_from: LessThanOrEqual(now),
        valid_until: MoreThanOrEqual(now),
      },
      relations: ['products', 'products.product'],
      order: { valid_until: 'ASC' },
    });
  }

  /**
   * Obtiene una promoción por ID
   */
  async getPromotionById(
    storeId: string,
    promotionId: string,
  ): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({
      where: { id: promotionId, store_id: storeId },
      relations: ['products', 'products.product', 'products.variant'],
    });

    if (!promotion) {
      throw new NotFoundException('Promoción no encontrada');
    }

    return promotion;
  }

  /**
   * Obtiene una promoción por código
   */
  async getPromotionByCode(
    storeId: string,
    code: string,
  ): Promise<Promotion | null> {
    const now = new Date();

    return this.promotionRepository.findOne({
      where: {
        store_id: storeId,
        code,
        is_active: true,
        valid_from: LessThanOrEqual(now),
        valid_until: MoreThanOrEqual(now),
      },
      relations: ['products', 'products.product'],
    });
  }

  /**
   * Valida si una promoción puede aplicarse
   */
  async validatePromotion(
    storeId: string,
    promotionId: string,
    subtotalBs: number,
    subtotalUsd: number,
    customerId?: string | null,
  ): Promise<{ valid: boolean; error?: string }> {
    const promotion = await this.getPromotionById(storeId, promotionId);

    // Verificar que esté activa
    if (!promotion.is_active) {
      return { valid: false, error: 'La promoción no está activa' };
    }

    // Verificar vigencia
    const now = new Date();
    if (now < promotion.valid_from) {
      return { valid: false, error: 'La promoción aún no está vigente' };
    }
    if (now > promotion.valid_until) {
      return { valid: false, error: 'La promoción ha expirado' };
    }

    // Verificar límite de usos totales
    if (
      promotion.usage_limit &&
      promotion.usage_count >= promotion.usage_limit
    ) {
      return {
        valid: false,
        error: 'La promoción ha alcanzado su límite de usos',
      };
    }

    // Verificar límite por cliente
    if (promotion.customer_limit && customerId) {
      const customerUsages = await this.promotionUsageRepository.count({
        where: {
          promotion_id: promotionId,
          customer_id: customerId,
        },
      });

      if (customerUsages >= promotion.customer_limit) {
        return {
          valid: false,
          error: 'Has alcanzado el límite de usos de esta promoción',
        };
      }
    }

    // Verificar compra mínima
    if (promotion.min_purchase_bs && subtotalBs < promotion.min_purchase_bs) {
      return {
        valid: false,
        error: `Compra mínima requerida: ${promotion.min_purchase_bs} Bs`,
      };
    }

    if (
      promotion.min_purchase_usd &&
      subtotalUsd < promotion.min_purchase_usd
    ) {
      return {
        valid: false,
        error: `Compra mínima requerida: ${promotion.min_purchase_usd} USD`,
      };
    }

    return { valid: true };
  }

  /**
   * Calcula el descuento de una promoción
   */
  calculatePromotionDiscount(
    promotion: Promotion,
    subtotalBs: number,
    subtotalUsd: number,
  ): { discount_bs: number; discount_usd: number } {
    let discountBs = 0;
    let discountUsd = 0;

    if (promotion.promotion_type === 'percentage') {
      if (promotion.discount_percentage) {
        discountBs = (subtotalBs * promotion.discount_percentage) / 100;
        discountUsd = (subtotalUsd * promotion.discount_percentage) / 100;

        // Aplicar descuento máximo si existe
        if (
          promotion.max_discount_bs &&
          discountBs > promotion.max_discount_bs
        ) {
          discountBs = promotion.max_discount_bs;
        }
        if (
          promotion.max_discount_usd &&
          discountUsd > promotion.max_discount_usd
        ) {
          discountUsd = promotion.max_discount_usd;
        }
      }
    } else if (promotion.promotion_type === 'fixed_amount') {
      discountBs = promotion.discount_amount_bs || 0;
      discountUsd = promotion.discount_amount_usd || 0;

      // No exceder el subtotal
      if (discountBs > subtotalBs) {
        discountBs = subtotalBs;
      }
      if (discountUsd > subtotalUsd) {
        discountUsd = subtotalUsd;
      }
    }

    return { discount_bs: discountBs, discount_usd: discountUsd };
  }

  /**
   * Registra el uso de una promoción
   */
  async recordPromotionUsage(
    promotionId: string,
    saleId: string | null,
    customerId: string | null,
    discountBs: number,
    discountUsd: number,
  ): Promise<PromotionUsage> {
    return this.dataSource.transaction(async (manager) => {
      // Registrar uso
      const usage = manager.create(PromotionUsage, {
        id: randomUUID(),
        promotion_id: promotionId,
        sale_id: saleId,
        customer_id: customerId,
        discount_applied_bs: discountBs,
        discount_applied_usd: discountUsd,
      });

      const savedUsage = await manager.save(PromotionUsage, usage);

      // Incrementar contador de usos
      await manager.increment(Promotion, { id: promotionId }, 'usage_count', 1);

      return savedUsage;
    });
  }

  /**
   * Obtiene promociones aplicables a productos específicos
   */
  async getApplicablePromotions(
    storeId: string,
    productIds: string[],
    variantIds?: (string | null)[],
  ): Promise<Promotion[]> {
    const now = new Date();

    // Obtener promociones activas
    const promotions = await this.promotionRepository.find({
      where: {
        store_id: storeId,
        is_active: true,
        valid_from: LessThanOrEqual(now),
        valid_until: MoreThanOrEqual(now),
      },
      relations: ['products'],
    });

    // Filtrar promociones que aplican a los productos
    const applicablePromotions: Promotion[] = [];

    for (const promotion of promotions) {
      // Si no tiene productos específicos, aplica a todos
      if (promotion.products.length === 0) {
        applicablePromotions.push(promotion);
        continue;
      }

      // Verificar si alguno de los productos está en la promoción
      const hasMatchingProduct = promotion.products.some((pp) => {
        const productIndex = productIds.indexOf(pp.product_id);
        if (productIndex === -1) return false;

        // Si tiene variante, verificar que coincida
        if (pp.variant_id && variantIds) {
          return variantIds[productIndex] === pp.variant_id;
        }

        // Si no tiene variante, aplicar
        return !pp.variant_id;
      });

      if (hasMatchingProduct) {
        applicablePromotions.push(promotion);
      }
    }

    return applicablePromotions;
  }
}
