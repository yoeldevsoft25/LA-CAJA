import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { PriceList } from '../database/entities/price-list.entity';
import { PriceListItem } from '../database/entities/price-list-item.entity';
import { Product } from '../database/entities/product.entity';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { CreatePriceListItemDto } from './dto/create-price-list-item.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de listas de precio
 */
@Injectable()
export class PriceListsService {
  constructor(
    @InjectRepository(PriceList)
    private priceListRepository: Repository<PriceList>,
    @InjectRepository(PriceListItem)
    private priceListItemRepository: Repository<PriceListItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  /**
   * Crea una nueva lista de precio
   */
  async createPriceList(
    storeId: string,
    dto: CreatePriceListDto,
  ): Promise<PriceList> {
    // Verificar que no exista una lista con el mismo código
    const existing = await this.priceListRepository.findOne({
      where: { store_id: storeId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una lista con código "${dto.code}"`,
      );
    }

    // Si se marca como default, desmarcar otras
    if (dto.is_default) {
      await this.priceListRepository.update(
        { store_id: storeId, is_default: true },
        { is_default: false },
      );
    }

    const priceList = this.priceListRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      code: dto.code,
      description: dto.description || null,
      is_default: dto.is_default || false,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      valid_from: dto.valid_from ? new Date(dto.valid_from) : null,
      valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
      note: dto.note || null,
    });

    return this.priceListRepository.save(priceList);
  }

  /**
   * Obtiene todas las listas de precio de una tienda
   */
  async getPriceListsByStore(storeId: string): Promise<PriceList[]> {
    return this.priceListRepository.find({
      where: { store_id: storeId },
      relations: ['items'],
      order: { is_default: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Obtiene la lista de precio por defecto
   */
  async getDefaultPriceList(storeId: string): Promise<PriceList | null> {
    return this.priceListRepository.findOne({
      where: { store_id: storeId, is_default: true, is_active: true },
      relations: ['items'],
    });
  }

  /**
   * Obtiene una lista por ID
   */
  async getPriceListById(storeId: string, listId: string): Promise<PriceList> {
    const list = await this.priceListRepository.findOne({
      where: { id: listId, store_id: storeId },
      relations: ['items', 'items.product', 'items.variant'],
    });

    if (!list) {
      throw new NotFoundException('Lista de precio no encontrada');
    }

    return list;
  }

  /**
   * Agrega un item a una lista de precio
   */
  async addPriceListItem(
    storeId: string,
    listId: string,
    dto: CreatePriceListItemDto,
  ): Promise<PriceListItem> {
    await this.getPriceListById(storeId, listId);

    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no exista ya este item
    const where: any = {
      price_list_id: listId,
      product_id: dto.product_id,
      min_qty: dto.min_qty || IsNull(),
    };

    if (dto.variant_id) {
      where.variant_id = dto.variant_id;
    } else {
      where.variant_id = IsNull();
    }

    const existing = await this.priceListItemRepository.findOne({
      where,
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe un precio para este producto/variante/cantidad en esta lista',
      );
    }

    const item = this.priceListItemRepository.create({
      id: randomUUID(),
      price_list_id: listId,
      product_id: dto.product_id,
      variant_id: dto.variant_id || null,
      price_bs: dto.price_bs,
      price_usd: dto.price_usd,
      min_qty: dto.min_qty || null,
      note: dto.note || null,
    });

    return this.priceListItemRepository.save(item);
  }

  /**
   * Obtiene el precio de un producto según la lista de precio
   */
  async getProductPrice(
    storeId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    priceListId?: string,
  ): Promise<{ price_bs: number; price_usd: number } | null> {
    // Si no se especifica lista, usar la por defecto
    let list: PriceList | null;

    if (priceListId) {
      list = await this.priceListRepository.findOne({
        where: { id: priceListId, store_id: storeId, is_active: true },
        relations: ['items'],
      });
    } else {
      list = await this.getDefaultPriceList(storeId);
    }

    if (!list) {
      return null;
    }

    // Verificar vigencia
    const now = new Date();
    if (list.valid_from && now < list.valid_from) {
      return null;
    }
    if (list.valid_until && now > list.valid_until) {
      return null;
    }

    // Buscar precio según cantidad
    const items = list.items.filter(
      (item) =>
        item.product_id === productId &&
        item.variant_id === (variantId || null),
    );

    if (items.length === 0) {
      return null;
    }

    // Ordenar por min_qty descendente para encontrar el precio más apropiado
    const sortedItems = items.sort((a, b) => {
      const aQty = a.min_qty || 0;
      const bQty = b.min_qty || 0;
      return bQty - aQty;
    });

    // Encontrar el precio que aplica según la cantidad
    for (const item of sortedItems) {
      if (!item.min_qty || quantity >= item.min_qty) {
        return {
          price_bs: item.price_bs,
          price_usd: item.price_usd,
        };
      }
    }

    return null;
  }
}
