import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { Customer } from '../database/entities/customer.entity';

@Injectable()
export class BackupService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async createBackup(storeId: string): Promise<{
    store_id: string;
    created_at: string;
    products: any[];
    customers: any[];
    metadata: {
      product_count: number;
      customer_count: number;
    };
  }> {
    // Obtener productos
    const products = await this.productRepository.find({
      where: { store_id: storeId },
      order: { name: 'ASC' },
    });

    // Obtener clientes
    const customers = await this.customerRepository.find({
      where: { store_id: storeId },
      order: { name: 'ASC' },
    });

    // Formatear productos para backup
    const productsData = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sku: p.sku,
      barcode: p.barcode,
      price_bs: p.price_bs,
      price_usd: p.price_usd,
      cost_bs: p.cost_bs,
      cost_usd: p.cost_usd,
      low_stock_threshold: p.low_stock_threshold,
      is_active: p.is_active,
    }));

    // Formatear clientes para backup
    const customersData = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      note: c.note,
    }));

    return {
      store_id: storeId,
      created_at: new Date().toISOString(),
      products: productsData,
      customers: customersData,
      metadata: {
        product_count: productsData.length,
        customer_count: customersData.length,
      },
    };
  }

  async restoreFromBackup(
    storeId: string,
    backupData: {
      products?: any[];
      customers?: any[];
    },
  ): Promise<{
    restored: {
      products: number;
      customers: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let productsRestored = 0;
    let customersRestored = 0;

    // Restaurar productos
    if (backupData.products && backupData.products.length > 0) {
      for (const productData of backupData.products) {
        try {
          const existing = await this.productRepository.findOne({
            where: { id: productData.id, store_id: storeId },
          });

          if (existing) {
            // Actualizar producto existente
            Object.assign(existing, {
              name: productData.name,
              category: productData.category ?? null,
              sku: productData.sku ?? null,
              barcode: productData.barcode ?? null,
              price_bs: productData.price_bs,
              price_usd: productData.price_usd,
              cost_bs: productData.cost_bs,
              cost_usd: productData.cost_usd,
              low_stock_threshold: productData.low_stock_threshold || 0,
              is_active: productData.is_active !== false,
            });
            await this.productRepository.save(existing);
          } else {
            // Crear nuevo producto
            const product = this.productRepository.create({
              id: productData.id,
              store_id: storeId,
              name: productData.name,
              category: productData.category ?? null,
              sku: productData.sku ?? null,
              barcode: productData.barcode ?? null,
              price_bs: productData.price_bs,
              price_usd: productData.price_usd,
              cost_bs: productData.cost_bs,
              cost_usd: productData.cost_usd,
              low_stock_threshold: productData.low_stock_threshold || 0,
              is_active: productData.is_active !== false,
            });
            await this.productRepository.save(product);
          }
          productsRestored++;
        } catch (error) {
          errors.push(
            `Error restaurando producto ${productData.id}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          );
        }
      }
    }

    // Restaurar clientes
    if (backupData.customers && backupData.customers.length > 0) {
      for (const customerData of backupData.customers) {
        try {
          const existing = await this.customerRepository.findOne({
            where: { id: customerData.id, store_id: storeId },
          });

          if (existing) {
            // Actualizar cliente existente
            Object.assign(existing, {
              name: customerData.name,
              phone: customerData.phone ?? null,
              note: customerData.note ?? null,
              updated_at: new Date(),
            });
            await this.customerRepository.save(existing);
          } else {
            // Crear nuevo cliente
            const customer = this.customerRepository.create({
              id: customerData.id,
              store_id: storeId,
              name: customerData.name,
              phone: customerData.phone ?? null,
              note: customerData.note ?? null,
            });
            await this.customerRepository.save(customer);
          }
          customersRestored++;
        } catch (error) {
          errors.push(
            `Error restaurando cliente ${customerData.id}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          );
        }
      }
    }

    return {
      restored: {
        products: productsRestored,
        customers: customersRestored,
      },
      errors,
    };
  }
}
