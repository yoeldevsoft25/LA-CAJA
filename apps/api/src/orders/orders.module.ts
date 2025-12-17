import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { OrderPayment } from '../database/entities/order-payment.entity';
import { Table } from '../database/entities/table.entity';
import { Product } from '../database/entities/product.entity';
import { TablesModule } from '../tables/tables.module';
import { SalesModule } from '../sales/sales.module';

/**
 * Módulo para gestión de órdenes (cuentas abiertas)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderPayment, Table, Product]),
    TablesModule,
    SalesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
