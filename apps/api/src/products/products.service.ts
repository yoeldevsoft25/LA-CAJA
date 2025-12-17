import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
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
    const product = await this.findOne(storeId, productId);

    // Obtener tasa BCV una sola vez si es necesaria
    let exchangeRate: number | null = null;
    if (dto.price_usd !== undefined || dto.cost_usd !== undefined) {
      const bcvRate = await this.exchangeService.getBCVRate();
      exchangeRate = bcvRate?.rate || 36;
      this.logger.log(`Usando tasa BCV para actualización: ${exchangeRate}`);
    }

    // Actualizar campos básicos
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.category !== undefined) product.category = dto.category ?? null;
    if (dto.sku !== undefined) product.sku = dto.sku ?? null;
    if (dto.barcode !== undefined) product.barcode = dto.barcode ?? null;
    if (dto.low_stock_threshold !== undefined)
      product.low_stock_threshold = dto.low_stock_threshold;
    if (dto.is_active !== undefined) product.is_active = dto.is_active;

    // Si se actualiza el precio USD, recalcular el precio Bs usando la tasa BCV
    // SIEMPRE recalcular, ignorando cualquier price_bs que venga en el DTO
    if (dto.price_usd !== undefined && exchangeRate !== null) {
      product.price_usd = this.roundToTwoDecimals(dto.price_usd);
      product.price_bs = this.roundToTwoDecimals(dto.price_usd * exchangeRate);
      this.logger.log(
        `Actualizando precio: price_usd=${product.price_usd} -> price_bs=${product.price_bs.toFixed(2)} (tasa=${exchangeRate})`,
      );
    }

    // Si se actualiza el costo USD, recalcular el costo Bs usando la tasa BCV
    // SIEMPRE recalcular, ignorando cualquier cost_bs que venga en el DTO
    if (dto.cost_usd !== undefined && exchangeRate !== null) {
      product.cost_usd = this.roundToTwoDecimals(dto.cost_usd);
      product.cost_bs = this.roundToTwoDecimals(dto.cost_usd * exchangeRate);
      this.logger.log(
        `Actualizando costo: cost_usd=${product.cost_usd} -> cost_bs=${product.cost_bs.toFixed(2)} (tasa=${exchangeRate})`,
      );
    }

    return this.productRepository.save(product);
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
