import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, EntityManager } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ChangePriceDto } from './dto/change-price.dto';
import { BulkPriceChangeDto } from './dto/bulk-price-change.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { ExchangeService } from '../exchange/exchange.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  private readonly weightUnitToKg: Record<'kg' | 'g' | 'lb' | 'oz', number> = {
    kg: 1,
    g: 0.001,
    lb: 0.45359237,
    oz: 0.028349523125,
  };

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private exchangeService: ExchangeService,
  ) {}

  /**
   * Redondea un número a 2 decimales
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundToDecimals(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private convertWeightValue(
    value: number,
    fromUnit: 'kg' | 'g' | 'lb' | 'oz',
    toUnit: 'kg' | 'g' | 'lb' | 'oz',
  ): number {
    return (
      value * (this.weightUnitToKg[fromUnit] / this.weightUnitToKg[toUnit])
    );
  }

  private convertWeightPrice(
    value: number,
    fromUnit: 'kg' | 'g' | 'lb' | 'oz',
    toUnit: 'kg' | 'g' | 'lb' | 'oz',
  ): number {
    return (
      value * (this.weightUnitToKg[toUnit] / this.weightUnitToKg[fromUnit])
    );
  }

  private async applyWeightUnitConversion(
    manager: EntityManager,
    storeId: string,
    productId: string,
    fromUnit: 'kg' | 'g' | 'lb' | 'oz',
    toUnit: 'kg' | 'g' | 'lb' | 'oz',
  ): Promise<void> {
    const quantityFactor = this.convertWeightValue(1, fromUnit, toUnit);
    const priceFactor = this.convertWeightPrice(1, fromUnit, toUnit);

    if (!Number.isFinite(quantityFactor) || !Number.isFinite(priceFactor)) {
      throw new BadRequestException(
        `Conversión de unidad inválida (${fromUnit} -> ${toUnit})`,
      );
    }

    if (quantityFactor === 1 && priceFactor === 1) {
      return;
    }

    await manager.query(
      `UPDATE warehouse_stock
       SET stock = ROUND(stock * $1, 3),
           reserved = ROUND(reserved * $1, 3),
           updated_at = NOW()
       WHERE product_id = $2`,
      [quantityFactor, productId],
    );

    await manager.query(
      `UPDATE inventory_movements
       SET qty_delta = ROUND(qty_delta * $1, 3),
           unit_cost_bs = ROUND(unit_cost_bs * $2, 4),
           unit_cost_usd = ROUND(unit_cost_usd * $2, 4)
       WHERE product_id = $3 AND store_id = $4`,
      [quantityFactor, priceFactor, productId, storeId],
    );

    await manager.query(
      `UPDATE product_lots
       SET initial_quantity = ROUND(initial_quantity * $1, 3),
           remaining_quantity = ROUND(remaining_quantity * $1, 3),
           unit_cost_bs = ROUND(unit_cost_bs * $2, 4),
           unit_cost_usd = ROUND(unit_cost_usd * $2, 4),
           updated_at = NOW()
       WHERE product_id = $3`,
      [quantityFactor, priceFactor, productId],
    );

    await manager.query(
      `UPDATE lot_movements lm
       SET qty_delta = ROUND(lm.qty_delta * $1, 3)
       FROM product_lots pl
       WHERE pl.id = lm.lot_id AND pl.product_id = $2`,
      [quantityFactor, productId],
    );
  }

  async create(storeId: string, dto: CreateProductDto): Promise<Product> {
    // Obtener tasa BCV actual
    const bcvRate = await this.exchangeService.getBCVRate();
    const exchangeRate = bcvRate?.rate || 36; // Fallback a 36 si no se puede obtener

    // Calcular precios en Bs desde USD usando la tasa BCV y redondear a 2 decimales
    const price_bs = this.roundToTwoDecimals(dto.price_usd * exchangeRate);
    const cost_bs = this.roundToTwoDecimals(dto.cost_usd * exchangeRate);
    const price_usd = this.roundToTwoDecimals(dto.price_usd);
    const cost_usd = this.roundToTwoDecimals(dto.cost_usd);

    this.logger.log(
      `Creando producto: price_usd=${price_usd} -> price_bs=${price_bs.toFixed(2)} (tasa=${exchangeRate})`,
    );

    const isWeightProduct = dto.is_weight_product ?? false;
    const pricePerWeightUsd =
      isWeightProduct && dto.price_per_weight_usd != null
        ? this.roundToDecimals(dto.price_per_weight_usd, 4)
        : null;
    const pricePerWeightBs =
      isWeightProduct && pricePerWeightUsd !== null
        ? this.roundToDecimals(pricePerWeightUsd * exchangeRate, 4)
        : isWeightProduct
          ? dto.price_per_weight_bs ?? null
          : null;

    const product = this.productRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      category: dto.category ?? null,
      sku: dto.sku ?? null,
      barcode: dto.barcode ?? null,
      price_bs: price_bs,
      price_usd: price_usd,
      cost_bs: cost_bs,
      cost_usd: cost_usd,
      low_stock_threshold: dto.low_stock_threshold || 0,
      is_active: true,
      is_weight_product: isWeightProduct,
      weight_unit: isWeightProduct ? dto.weight_unit ?? null : null,
      price_per_weight_bs: pricePerWeightBs,
      price_per_weight_usd: pricePerWeightUsd,
      min_weight: isWeightProduct ? dto.min_weight ?? null : null,
      max_weight: isWeightProduct ? dto.max_weight ?? null : null,
      scale_plu: isWeightProduct ? dto.scale_plu ?? null : null,
      scale_department: isWeightProduct ? dto.scale_department ?? null : null,
    });

    return this.productRepository.save(product);
  }

  async findAll(
    storeId: string,
    searchDto: SearchProductsDto,
  ): Promise<{ products: Product[]; total: number }> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .where('product.store_id = :storeId', { storeId });

    if (searchDto.search) {
      query.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${searchDto.search}%` },
      );
    }

    if (searchDto.category) {
      query.andWhere('product.category = :category', {
        category: searchDto.category,
      });
    }

    if (searchDto.is_active !== undefined) {
      query.andWhere('product.is_active = :isActive', {
        isActive: searchDto.is_active,
      });
    }

    const total = await query.getCount();

    if (searchDto.limit) {
      query.limit(searchDto.limit);
    }
    if (searchDto.offset) {
      query.offset(searchDto.offset);
    }

    query.orderBy('product.name', 'ASC');

    const products = await query.getMany();

    return { products, total };
  }

  async findOne(storeId: string, productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    // Obtener tasa BCV una sola vez si es necesaria
    let exchangeRate: number | null = null;
    if (
      dto.price_usd !== undefined ||
      dto.cost_usd !== undefined ||
      dto.price_per_weight_usd != null
    ) {
      const bcvRate = await this.exchangeService.getBCVRate();
      exchangeRate = bcvRate?.rate || 36;
      this.logger.log(`Usando tasa BCV para actualización: ${exchangeRate}`);
    }

    return this.productRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const product = await productRepo.findOne({
        where: { id: productId, store_id: storeId },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      let unitChanged = false;
      let previousUnit: 'kg' | 'g' | 'lb' | 'oz' | null = null;
      let currentUnit: 'kg' | 'g' | 'lb' | 'oz' | null = null;

      // Actualizar campos básicos
      if (dto.name !== undefined) product.name = dto.name;
      if (dto.category !== undefined) product.category = dto.category ?? null;
      if (dto.sku !== undefined) product.sku = dto.sku ?? null;
      if (dto.barcode !== undefined) product.barcode = dto.barcode ?? null;
      if (dto.low_stock_threshold !== undefined)
        product.low_stock_threshold = dto.low_stock_threshold;
      if (dto.is_active !== undefined) product.is_active = dto.is_active;
      if (dto.is_weight_product !== undefined)
        product.is_weight_product = dto.is_weight_product;

      // Si se actualiza el precio USD, recalcular el precio Bs usando la tasa BCV
      // SIEMPRE recalcular, ignorando cualquier price_bs que venga en el DTO
      if (dto.price_usd !== undefined && exchangeRate !== null) {
        product.price_usd = this.roundToTwoDecimals(dto.price_usd);
        product.price_bs = this.roundToTwoDecimals(
          dto.price_usd * exchangeRate,
        );
        this.logger.log(
          `Actualizando precio: price_usd=${product.price_usd} -> price_bs=${product.price_bs.toFixed(2)} (tasa=${exchangeRate})`,
        );
      }

      // Si se actualiza el costo USD, recalcular el costo Bs usando la tasa BCV
      // SIEMPRE recalcular, ignorando cualquier cost_bs que venga en el DTO
      if (dto.cost_usd !== undefined && exchangeRate !== null) {
        product.cost_usd = this.roundToTwoDecimals(dto.cost_usd);
        product.cost_bs = this.roundToTwoDecimals(
          dto.cost_usd * exchangeRate,
        );
        this.logger.log(
          `Actualizando costo: cost_usd=${product.cost_usd} -> cost_bs=${product.cost_bs.toFixed(2)} (tasa=${exchangeRate})`,
        );
      }

      const isWeightProduct = product.is_weight_product;
      if (!isWeightProduct) {
        product.weight_unit = null;
        product.price_per_weight_bs = null;
        product.price_per_weight_usd = null;
        product.min_weight = null;
        product.max_weight = null;
        product.scale_plu = null;
        product.scale_department = null;
      } else {
        previousUnit = (product.weight_unit || 'kg') as
          | 'kg'
          | 'g'
          | 'lb'
          | 'oz';
        if (dto.weight_unit !== undefined) product.weight_unit = dto.weight_unit;
        currentUnit = (product.weight_unit || 'kg') as
          | 'kg'
          | 'g'
          | 'lb'
          | 'oz';
        unitChanged = previousUnit !== currentUnit;

        if (unitChanged) {
          if (
            dto.price_per_weight_usd == null &&
            dto.price_per_weight_bs == null
          ) {
            if (product.price_per_weight_usd != null) {
              product.price_per_weight_usd = this.roundToDecimals(
                this.convertWeightPrice(
                  product.price_per_weight_usd,
                  previousUnit,
                  currentUnit,
                ),
                4,
              );
            }

            if (
              product.price_per_weight_bs != null &&
              (product.price_per_weight_usd == null || exchangeRate === null)
            ) {
              product.price_per_weight_bs = this.roundToDecimals(
                this.convertWeightPrice(
                  product.price_per_weight_bs,
                  previousUnit,
                  currentUnit,
                ),
                4,
              );
            }

            if (product.price_per_weight_usd != null && exchangeRate !== null) {
              product.price_per_weight_bs = this.roundToDecimals(
                product.price_per_weight_usd * exchangeRate,
                4,
              );
            }
          }

          if (dto.min_weight === undefined && product.min_weight != null) {
            product.min_weight = this.roundToDecimals(
              this.convertWeightValue(
                product.min_weight,
                previousUnit,
                currentUnit,
              ),
              3,
            );
          }

          if (dto.max_weight === undefined && product.max_weight != null) {
            product.max_weight = this.roundToDecimals(
              this.convertWeightValue(
                product.max_weight,
                previousUnit,
                currentUnit,
              ),
              3,
            );
          }
        }

        if (dto.min_weight !== undefined) product.min_weight = dto.min_weight;
        if (dto.max_weight !== undefined) product.max_weight = dto.max_weight;
        if (dto.scale_plu !== undefined) product.scale_plu = dto.scale_plu;
        if (dto.scale_department !== undefined)
          product.scale_department = dto.scale_department;

        if (dto.price_per_weight_usd != null && exchangeRate !== null) {
          product.price_per_weight_usd = this.roundToDecimals(
            dto.price_per_weight_usd,
            4,
          );
          product.price_per_weight_bs = this.roundToDecimals(
            dto.price_per_weight_usd * exchangeRate,
            4,
          );
        } else if (dto.price_per_weight_bs != null) {
          product.price_per_weight_bs = this.roundToDecimals(
            dto.price_per_weight_bs,
            4,
          );
        }
      }

      const savedProduct = await productRepo.save(product);

      if (unitChanged && product.is_weight_product && previousUnit && currentUnit) {
        this.logger.log(
          `Convirtiendo inventario de ${previousUnit} a ${currentUnit} para producto ${product.id}`,
        );
        await this.applyWeightUnitConversion(
          manager,
          storeId,
          product.id,
          previousUnit,
          currentUnit,
        );
      }

      return savedProduct;
    });
  }

  async changePrice(
    storeId: string,
    productId: string,
    dto: ChangePriceDto,
  ): Promise<Product> {
    const product = await this.findOne(storeId, productId);

    // Obtener tasa BCV actual
    const bcvRate = await this.exchangeService.getBCVRate();
    const exchangeRate = bcvRate?.rate || 36;

    // Calcular price_bs desde price_usd usando la tasa BCV
    const priceUsd = this.roundToTwoDecimals(dto.price_usd);
    let priceBs = priceUsd * exchangeRate;

    // Aplicar redondeo si se especifica
    const rounding = dto.rounding || 'none';
    if (rounding !== 'none') {
      priceBs = this.applyPriceChange(priceBs, 0, rounding);
      // Si hay redondeo, también se puede aplicar al USD si es necesario
      // Por ahora solo redondeamos el Bs
    }

    // Siempre redondear a 2 decimales al final
    priceBs = this.roundToTwoDecimals(priceBs);

    this.logger.log(
      `Cambiando precio: price_usd=${priceUsd} -> price_bs=${priceBs.toFixed(2)} (tasa=${exchangeRate}, redondeo=${rounding})`,
    );

    product.price_usd = priceUsd;
    product.price_bs = priceBs;

    return this.productRepository.save(product);
  }

  async bulkPriceChange(
    storeId: string,
    dto: BulkPriceChangeDto,
  ): Promise<{ updated: number; products: Product[] }> {
    const { items, category, percentage_change, rounding = 'none' } = dto;

    let productsToUpdate: Product[] = [];

    if (items && items.length > 0) {
      // Cambio masivo por lista de productos
      const productIds = items.map((item) => item.product_id);
      productsToUpdate = await this.productRepository.find({
        where: {
          id: In(productIds),
          store_id: storeId,
          is_active: true,
        },
      });

      for (const product of productsToUpdate) {
        const item = items.find((i) => i.product_id === product.id);
        if (item) {
          if (item.price_bs !== undefined) {
            product.price_bs = item.price_bs;
          }
          if (item.price_usd !== undefined) {
            product.price_usd = item.price_usd;
          }
        }
      }
    } else if (category && category !== 'TODAS') {
      // Cambio masivo por categoría específica
      productsToUpdate = await this.productRepository.find({
        where: {
          store_id: storeId,
          category: category,
          is_active: true,
        },
      });

      for (const product of productsToUpdate) {
        if (percentage_change) {
          // Aplicar cambio porcentual
          product.price_bs = this.applyPriceChange(
            product.price_bs,
            percentage_change,
            rounding,
          );
          product.price_usd = this.applyPriceChange(
            product.price_usd,
            percentage_change,
            rounding,
          );
        }
      }
    } else if (category === 'TODAS' || (!category && percentage_change)) {
      // Cambio masivo a TODOS los productos activos
      productsToUpdate = await this.productRepository.find({
        where: {
          store_id: storeId,
          is_active: true,
        },
      });

      for (const product of productsToUpdate) {
        if (percentage_change) {
          // Aplicar cambio porcentual
          product.price_bs = this.applyPriceChange(
            product.price_bs,
            percentage_change,
            rounding,
          );
          product.price_usd = this.applyPriceChange(
            product.price_usd,
            percentage_change,
            rounding,
          );
        }
      }
    } else {
      throw new BadRequestException(
        'Debe proporcionar items o category para cambio masivo',
      );
    }

    const savedProducts = await this.productRepository.save(productsToUpdate);

    return {
      updated: savedProducts.length,
      products: savedProducts,
    };
  }

  private applyPriceChange(
    currentPrice: number,
    percentageChange: number,
    rounding: 'none' | '0.1' | '0.5' | '1',
  ): number {
    let newPrice = currentPrice * (1 + percentageChange / 100);

    switch (rounding) {
      case '0.1':
        newPrice = Math.round(newPrice * 10) / 10;
        break;
      case '0.5':
        newPrice = Math.round(newPrice * 2) / 2;
        break;
      case '1':
        newPrice = Math.round(newPrice);
        break;
      case 'none':
      default:
        // Redondear a 2 decimales por defecto
        newPrice = this.roundToTwoDecimals(newPrice);
        break;
    }

    // Siempre asegurar máximo 2 decimales al final y que no sea negativo
    return Math.max(0, this.roundToTwoDecimals(newPrice));
  }

  async deactivate(storeId: string, productId: string): Promise<Product> {
    const product = await this.findOne(storeId, productId);
    product.is_active = false;
    return this.productRepository.save(product);
  }

  async activate(storeId: string, productId: string): Promise<Product> {
    const product = await this.findOne(storeId, productId);
    product.is_active = true;
    return this.productRepository.save(product);
  }

  async importFromCSV(
    storeId: string,
    csvData: string,
  ): Promise<{ created: number; errors: string[] }> {
    const lines = csvData.trim().split('\n');
    const errors: string[] = [];
    let created = 0;

    // Saltar header si existe
    const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const columns = this.parseCSVLine(line);

        if (columns.length < 2) {
          errors.push(`Línea ${i + 1}: Formato inválido`);
          continue;
        }

        const [
          name,
          category,
          sku,
          barcode,
          priceBs,
          priceUsd,
          costBs,
          costUsd,
        ] = columns;

        const productData: CreateProductDto = {
          name: name || `Producto ${i}`,
          price_bs: parseFloat(priceBs || '0') || 0,
          price_usd: parseFloat(priceUsd || '0') || 0,
          cost_bs: parseFloat(costBs || '0') || 0,
          cost_usd: parseFloat(costUsd || '0') || 0,
        };

        if (category && category.trim()) {
          productData.category = category.trim();
        }
        if (sku && sku.trim()) {
          productData.sku = sku.trim();
        }
        if (barcode && barcode.trim()) {
          productData.barcode = barcode.trim();
        }

        await this.create(storeId, productData);

        created++;
      } catch (error) {
        errors.push(
          `Línea ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        );
      }
    }

    return { created, errors };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}
