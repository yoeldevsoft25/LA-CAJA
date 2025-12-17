import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  ProductSerial,
  SerialStatus,
} from '../database/entities/product-serial.entity';
import { Product } from '../database/entities/product.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { CreateProductSerialDto } from './dto/create-product-serial.dto';
import { AssignSerialsDto } from './dto/assign-serials.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de seriales de productos
 */
@Injectable()
export class ProductSerialsService {
  constructor(
    @InjectRepository(ProductSerial)
    private serialRepository: Repository<ProductSerial>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    private dataSource: DataSource,
  ) {}

  /**
   * Crea un nuevo serial de producto
   */
  async createSerial(
    storeId: string,
    dto: CreateProductSerialDto,
  ): Promise<ProductSerial> {
    // Verificar que el producto existe y pertenece a la tienda
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no existe un serial con el mismo número
    const existing = await this.serialRepository.findOne({
      where: {
        product_id: dto.product_id,
        serial_number: dto.serial_number,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un serial con número "${dto.serial_number}" para este producto`,
      );
    }

    const serial = this.serialRepository.create({
      id: randomUUID(),
      product_id: dto.product_id,
      serial_number: dto.serial_number,
      status: 'available',
      received_at: new Date(dto.received_at),
      note: dto.note || null,
    });

    return this.serialRepository.save(serial);
  }

  /**
   * Crea múltiples seriales en lote
   */
  async createSerialsBatch(
    storeId: string,
    productId: string,
    serialNumbers: string[],
    receivedAt: Date,
  ): Promise<ProductSerial[]> {
    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar que no existan seriales duplicados
    const existing = await this.serialRepository.find({
      where: {
        product_id: productId,
        serial_number: In(serialNumbers),
      },
    });

    if (existing.length > 0) {
      const existingNumbers = existing.map((s) => s.serial_number).join(', ');
      throw new BadRequestException(
        `Los siguientes números de serie ya existen: ${existingNumbers}`,
      );
    }

    const serials = serialNumbers.map((serialNumber) =>
      this.serialRepository.create({
        id: randomUUID(),
        product_id: productId,
        serial_number: serialNumber,
        status: 'available',
        received_at: receivedAt,
      }),
    );

    return this.serialRepository.save(serials);
  }

  /**
   * Obtiene todos los seriales de un producto
   */
  async getSerialsByProduct(
    storeId: string,
    productId: string,
    status?: SerialStatus,
  ): Promise<ProductSerial[]> {
    // Verificar que el producto existe
    const product = await this.productRepository.findOne({
      where: { id: productId, store_id: storeId },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const where: any = { product_id: productId };
    if (status) {
      where.status = status;
    }

    return this.serialRepository.find({
      where,
      order: { received_at: 'DESC' },
    });
  }

  /**
   * Obtiene un serial por su número
   */
  async getSerialByNumber(
    storeId: string,
    productId: string,
    serialNumber: string,
  ): Promise<ProductSerial> {
    const serial = await this.serialRepository.findOne({
      where: {
        product_id: productId,
        serial_number: serialNumber,
      },
      relations: ['product'],
    });

    if (!serial || serial.product.store_id !== storeId) {
      throw new NotFoundException('Serial no encontrado');
    }

    return serial;
  }

  /**
   * Obtiene seriales disponibles de un producto
   */
  async getAvailableSerials(
    storeId: string,
    productId: string,
    quantity: number,
  ): Promise<ProductSerial[]> {
    const serials = await this.serialRepository.find({
      where: {
        product_id: productId,
        status: 'available',
      },
      relations: ['product'],
      order: { received_at: 'ASC' }, // FIFO
      take: quantity,
    });

    // Verificar que pertenecen a la tienda
    const validSerials = serials.filter((s) => s.product.store_id === storeId);

    if (validSerials.length < quantity) {
      throw new BadRequestException(
        `No hay suficientes seriales disponibles. Disponibles: ${validSerials.length}, Solicitados: ${quantity}`,
      );
    }

    return validSerials;
  }

  /**
   * Asigna seriales a una venta
   */
  async assignSerialsToSale(
    storeId: string,
    dto: AssignSerialsDto,
  ): Promise<ProductSerial[]> {
    // Verificar que la venta existe y pertenece a la tienda
    const sale = await this.saleRepository.findOne({
      where: { id: dto.sale_id, store_id: storeId },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Verificar que el sale_item existe y pertenece a la venta
    const saleItem = await this.saleItemRepository.findOne({
      where: { id: dto.sale_item_id, sale_id: dto.sale_id },
      relations: ['product'],
    });

    if (!saleItem) {
      throw new NotFoundException('Item de venta no encontrado');
    }

    // Verificar que la cantidad de seriales coincide con la cantidad vendida
    if (dto.serial_numbers.length !== saleItem.qty) {
      throw new BadRequestException(
        `La cantidad de seriales (${dto.serial_numbers.length}) debe coincidir con la cantidad vendida (${saleItem.qty})`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const updatedSerials: ProductSerial[] = [];

      for (const serialNumber of dto.serial_numbers) {
        const serial = await manager.findOne(ProductSerial, {
          where: {
            product_id: saleItem.product_id,
            serial_number: serialNumber,
          },
        });

        if (!serial) {
          throw new NotFoundException(
            `Serial "${serialNumber}" no encontrado para el producto`,
          );
        }

        if (serial.status !== 'available') {
          throw new BadRequestException(
            `El serial "${serialNumber}" no está disponible. Estado: ${serial.status}`,
          );
        }

        // Verificar que pertenece a la tienda
        const product = await manager.findOne(Product, {
          where: { id: serial.product_id, store_id: storeId },
        });

        if (!product) {
          throw new NotFoundException('Producto no encontrado');
        }

        // Actualizar serial
        serial.status = 'sold';
        serial.sale_id = dto.sale_id;
        serial.sale_item_id = dto.sale_item_id;
        serial.sold_at = new Date();
        serial.updated_at = new Date();

        const savedSerial = await manager.save(ProductSerial, serial);
        updatedSerials.push(savedSerial);
      }

      return updatedSerials;
    });
  }

  /**
   * Marca un serial como devuelto
   */
  async returnSerial(
    storeId: string,
    serialId: string,
  ): Promise<ProductSerial> {
    const serial = await this.serialRepository.findOne({
      where: { id: serialId },
      relations: ['product'],
    });

    if (!serial || serial.product.store_id !== storeId) {
      throw new NotFoundException('Serial no encontrado');
    }

    if (serial.status !== 'sold') {
      throw new BadRequestException(
        `Solo se pueden devolver seriales vendidos. Estado actual: ${serial.status}`,
      );
    }

    serial.status = 'returned';
    serial.sale_id = null;
    serial.sale_item_id = null;
    serial.sold_at = null;
    serial.updated_at = new Date();

    return this.serialRepository.save(serial);
  }

  /**
   * Marca un serial como dañado
   */
  async markSerialAsDamaged(
    storeId: string,
    serialId: string,
    note?: string,
  ): Promise<ProductSerial> {
    const serial = await this.serialRepository.findOne({
      where: { id: serialId },
      relations: ['product'],
    });

    if (!serial || serial.product.store_id !== storeId) {
      throw new NotFoundException('Serial no encontrado');
    }

    serial.status = 'damaged';
    serial.note = note || serial.note;
    serial.updated_at = new Date();

    return this.serialRepository.save(serial);
  }

  /**
   * Obtiene los seriales de una venta
   */
  async getSerialsBySale(
    storeId: string,
    saleId: string,
  ): Promise<ProductSerial[]> {
    // Verificar que la venta existe
    const sale = await this.saleRepository.findOne({
      where: { id: saleId, store_id: storeId },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return this.serialRepository.find({
      where: { sale_id: saleId },
      relations: ['product'],
      order: { sold_at: 'DESC' },
    });
  }

  /**
   * Obtiene los seriales de un item de venta
   */
  async getSerialsBySaleItem(
    storeId: string,
    saleItemId: string,
  ): Promise<ProductSerial[]> {
    // Verificar que el sale_item existe
    const saleItem = await this.saleItemRepository.findOne({
      where: { id: saleItemId },
      relations: ['sale'],
    });

    if (!saleItem || saleItem.sale.store_id !== storeId) {
      throw new NotFoundException('Item de venta no encontrado');
    }

    return this.serialRepository.find({
      where: { sale_item_id: saleItemId },
      relations: ['product'],
      order: { sold_at: 'DESC' },
    });
  }
}
