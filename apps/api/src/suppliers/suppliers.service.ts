import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Supplier } from '../database/entities/supplier.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de proveedores
 */
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
  ) {}

  /**
   * Crea un nuevo proveedor
   */
  async create(storeId: string, dto: CreateSupplierDto): Promise<Supplier> {
    // Validar que el código no exista (si se proporciona)
    if (dto.code) {
      const existing = await this.supplierRepository.findOne({
        where: { store_id: storeId, code: dto.code },
      });

      if (existing) {
        throw new BadRequestException(
          `Ya existe un proveedor con el código "${dto.code}"`,
        );
      }
    }

    const supplier = this.supplierRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      code: dto.code || null,
      contact_name: dto.contact_name || null,
      email: dto.email || null,
      phone: dto.phone || null,
      address: dto.address || null,
      tax_id: dto.tax_id || null,
      payment_terms: dto.payment_terms || null,
      is_active: true,
      note: dto.note || null,
    });

    return this.supplierRepository.save(supplier);
  }

  /**
   * Obtiene todos los proveedores de una tienda
   */
  async findAll(
    storeId: string,
    includeInactive: boolean = false,
  ): Promise<Supplier[]> {
    const where: any = { store_id: storeId };
    if (!includeInactive) {
      where.is_active = true;
    }

    return this.supplierRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtiene un proveedor por ID
   */
  async findOne(storeId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, store_id: storeId },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  /**
   * Actualiza un proveedor
   */
  async update(
    storeId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(storeId, supplierId);

    // Si se cambia el código, validar que no exista
    if (dto.code && dto.code !== supplier.code) {
      const existing = await this.supplierRepository.findOne({
        where: { store_id: storeId, code: dto.code },
      });

      if (existing) {
        throw new BadRequestException(
          `Ya existe un proveedor con el código "${dto.code}"`,
        );
      }
    }

    // Actualizar campos
    if (dto.name !== undefined) supplier.name = dto.name;
    if (dto.code !== undefined) supplier.code = dto.code;
    if (dto.contact_name !== undefined)
      supplier.contact_name = dto.contact_name;
    if (dto.email !== undefined) supplier.email = dto.email;
    if (dto.phone !== undefined) supplier.phone = dto.phone;
    if (dto.address !== undefined) supplier.address = dto.address;
    if (dto.tax_id !== undefined) supplier.tax_id = dto.tax_id;
    if (dto.payment_terms !== undefined)
      supplier.payment_terms = dto.payment_terms;
    if (dto.is_active !== undefined) supplier.is_active = dto.is_active;
    if (dto.note !== undefined) supplier.note = dto.note;

    return this.supplierRepository.save(supplier);
  }

  /**
   * Elimina un proveedor (soft delete: desactiva)
   */
  async remove(storeId: string, supplierId: string): Promise<void> {
    const supplier = await this.findOne(storeId, supplierId);

    // Verificar que no tenga órdenes de compra activas
    const activeOrders = await this.purchaseOrderRepository.count({
      where: {
        supplier_id: supplierId,
        store_id: storeId,
        status: In(['draft', 'sent', 'confirmed', 'partial']),
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException(
        `No se puede eliminar el proveedor porque tiene ${activeOrders} orden(es) de compra activa(s)`,
      );
    }

    supplier.is_active = false;
    await this.supplierRepository.save(supplier);
  }

  /**
   * Obtiene estadísticas de un proveedor
   */
  async getStatistics(
    storeId: string,
    supplierId: string,
  ): Promise<{
    total_orders: number;
    total_amount_bs: number;
    total_amount_usd: number;
    pending_orders: number;
    completed_orders: number;
    last_order_date: Date | null;
  }> {
    const supplier = await this.findOne(storeId, supplierId);

    const orders = await this.purchaseOrderRepository.find({
      where: { supplier_id: supplierId, store_id: storeId },
    });

    const total_orders = orders.length;
    let total_amount_bs = 0;
    let total_amount_usd = 0;
    let pending_orders = 0;
    let completed_orders = 0;
    let last_order_date: Date | null = null;

    for (const order of orders) {
      total_amount_bs += Number(order.total_amount_bs);
      total_amount_usd += Number(order.total_amount_usd);

      if (['draft', 'sent', 'confirmed', 'partial'].includes(order.status)) {
        pending_orders++;
      }
      if (order.status === 'completed') {
        completed_orders++;
      }

      if (!last_order_date || order.created_at > last_order_date) {
        last_order_date = order.created_at;
      }
    }

    return {
      total_orders,
      total_amount_bs,
      total_amount_usd,
      pending_orders,
      completed_orders,
      last_order_date,
    };
  }

  /**
   * Obtiene las órdenes de compra de un proveedor
   */
  async getPurchaseOrders(
    storeId: string,
    supplierId: string,
    status?: string,
  ): Promise<PurchaseOrder[]> {
    await this.findOne(storeId, supplierId); // Validar que existe

    const where: any = {
      supplier_id: supplierId,
      store_id: storeId,
    };

    if (status) {
      where.status = status;
    }

    return this.purchaseOrderRepository.find({
      where,
      relations: ['items'],
      order: { created_at: 'DESC' },
    });
  }
}
